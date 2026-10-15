import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mountPattern } from './harness.mjs';

async function model() {
  const result = await build({
    entryPoints: ['docs/src/data/pill-colors.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
}

test('Pill allocator starts randomly, avoids the last color and chooses a least-used candidate', async () => {
  const { createPillColorAllocator } = await model();
  for (const start of [0, 0.2, 0.55, 0.999]) {
    const group = createPillColorAllocator({ paletteSize: 17, random: () => start });
    let previous;
    for (let count = 1; count <= 120; count++) {
      const keys = Array.from({ length: count }, (_, i) => `tag-${i}`);
      const before = group.snapshot();
      const assigned = group.reconcile(keys);
      const next = assigned.get(keys.at(-1));
      assert.ok(Number.isInteger(next) && next >= 0 && next < 17);
      if (previous !== undefined) assert.notEqual(next, previous);
      const uses = Array.from({ length: 17 }, () => 0);
      for (const color of before.values()) uses[color]++;
      const min = Math.min(...uses.filter((_, color) => color !== previous));
      assert.equal(uses[next], min);
      if (count <= 17) assert.equal(new Set(assigned.values()).size, count);
      const counts = Array.from(
        { length: 17 },
        (_, color) => [...assigned.values()].filter(v => v === color).length,
      );
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
      previous = next;
    }
    assert.equal(group.snapshot().get('tag-0'), Math.floor(start * 17));
  }
});

test('Pill allocation survives removals, reordering, duplicate keys and repeated synchronization', async () => {
  const { createPillColorAllocator } = await model();
  const group = createPillColorAllocator({ paletteSize: 5, random: () => 0.5 });
  const initial = group.reconcile(['a', 'b', 'c']);
  const b = initial.get('b'),
    c = initial.get('c');
  group.reconcile(['c', 'b', 'c']);
  assert.equal(group.snapshot().size, 2);
  assert.equal(group.snapshot().get('b'), b);
  assert.equal(group.snapshot().get('c'), c);
  const stable = group.snapshot();
  assert.equal(group.reconcile(['b', 'c']), stable);
  group.reconcile(['b', 'c', 'new']);
  assert.notEqual(group.snapshot().get('new'), c);
  assert.equal(initial.size, 3, 'snapshots are immutable views of earlier assignments');
  group.reconcile([]);
  const last = group.lastColor();
  group.reconcile(['new-first']);
  assert.notEqual(group.snapshot().get('new-first'), last);
});

test('Pill allocator remains bounded with unusable entropy and rejects invalid palette sizes', async () => {
  const { createPillColorAllocator } = await model();
  for (const size of [0, -1, 1, 2.5, Infinity])
    assert.throws(() => createPillColorAllocator({ paletteSize: size }));
  for (const random of [
    () => NaN,
    () => Infinity,
    () => -2,
    () => 1,
    () => {
      throw Error('entropy unavailable');
    },
  ]) {
    const group = createPillColorAllocator({ paletteSize: 3, random });
    for (let i = 0; i < 100; i++)
      group.reconcile(Array.from({ length: i + 1 }, (_, j) => String(j)));
    assert.ok([...group.snapshot().values()].every(v => Number.isInteger(v) && v >= 0 && v < 3));
  }
});

test('component-owned Pill scope changes new colors without recoloring existing labels', async t => {
  const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('#select-tags');
  const owner = input.closest('.ant-select');
  const colors = [];
  for (let i = 0; i < 20; i++) {
    await h.type(input, `New ${i}`);
    await h.act(() =>
      input.dispatchEvent(
        new h.window.KeyboardEvent('keydown', {
          key: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await h.act(() =>
      input.dispatchEvent(
        new h.window.KeyboardEvent('keyup', {
          key: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
        }),
      ),
    );
    await h.waitFor(
      () => owner.querySelectorAll('.atlas-pill[data-pill-color]').length === i + 1,
      `component color assigned: ${i}; ${owner.textContent}`,
    );
    const pills = [...owner.querySelectorAll('.atlas-pill')];
    const color = pills.at(-1).dataset.pillColor;
    if (i > 0) assert.notEqual(color, colors.at(-1));
    if (i < 17) assert.equal(colors.includes(color), false);
    colors.push(color);
    assert.deepEqual(
      pills.map(p => p.dataset.pillColor),
      colors,
    );
  }
  const retained = [...owner.querySelectorAll('.atlas-pill')].at(-1);
  await h.click(owner.querySelector('.atlas-pill-close'));
  assert.equal([...owner.querySelectorAll('.atlas-pill')].at(-1), retained);
  assert.equal(retained.dataset.pillColor, colors.at(-1));
  await h.act(() => h.setLocale('tr'));
  assert.equal(retained.dataset.pillColor, colors.at(-1));
});

test('independent Pill collections do not share allocation state and old snapshots cannot be mutated', async () => {
  const { createPillColorAllocator } = await model();
  const a = createPillColorAllocator({ random: () => 0 });
  const b = createPillColorAllocator({ random: () => 0.999 });
  assert.notEqual(a.reconcile(['x']).get('x'), b.reconcile(['x']).get('x'));
  const snapshot = a.snapshot();
  assert.equal(snapshot.set, undefined);
  assert.ok(Object.isFrozen(snapshot));
  let visited = 0;
  snapshot.forEach((value, key, view) => {
    assert.equal(view, snapshot);
    assert.equal(value, snapshot.get(key));
    visited++;
  });
  assert.equal(visited, 1);
  a.reconcile(['y']);
  assert.equal(snapshot.has('x'), true);
  assert.equal(a.snapshot().has('x'), false);
});

test('automatic Pill colors work without an input and survive theme, size and locale changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const group = h.document.querySelector('[data-pill-automatic]');
  const initial = [...group.querySelectorAll('.atlas-pill')];
  const colors = initial.map(p => p.dataset.pillColor);
  assert.equal(new Set(colors).size, 3);
  assert.equal(group.querySelectorAll('input').length, 0);
  const add = [...group.querySelectorAll('button')].find(b => b.textContent === 'Add tag');
  await h.click(add);
  const fourth = [...group.querySelectorAll('.atlas-pill')].at(-1);
  assert.ok(!colors.includes(fourth.dataset.pillColor));
  for (const mode of ['dark', 'light']) {
    await h.act(() => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
    });
    assert.equal(group.querySelector('.atlas-pill'), initial[0]);
    assert.deepEqual(
      [...group.querySelectorAll('.atlas-pill')].slice(0, 3).map(p => p.dataset.pillColor),
      colors,
    );
  }
  await h.act(() => h.setLocale('tr'));
  assert.equal(group.querySelector('.atlas-pill'), initial[0]);
  assert.deepEqual(
    [...group.querySelectorAll('.atlas-pill')].slice(0, 3).map(p => p.dataset.pillColor),
    colors,
  );
  const close = initial[0].querySelector('.atlas-pill-close');
  await h.act(() => close.focus());
  await h.click(close);
  assert.equal(h.document.activeElement, initial[1].querySelector('.atlas-pill-close'));
  assert.equal(group.querySelector('.atlas-pill'), initial[1]);
  assert.equal(initial[1].dataset.pillColor, colors[1]);
});

test('least-used ties keep the next pastel hue far from the existing collection', async () => {
  const { createPillColorAllocator } = await model();
  const compiled = await build({
    entryPoints: ['docs/src/data/pill-palette.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { pillColorPresets } = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  const group = createPillColorAllocator({ random: () => 0 });
  const first = group.reconcile(['a']).get('a');
  const second = group.reconcile(['a', 'b']).get('b');
  const distance = i => {
    const delta = Math.abs(pillColorPresets[first].hue - pillColorPresets[i].hue);
    return Math.min(delta, 360 - delta);
  };
  assert.equal(distance(second), Math.max(...pillColorPresets.map((_, i) => distance(i))));
});
