import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';
import { build } from 'esbuild';

test('documentation Pills use ordered native Tag fills and retain colors when another label is removed', async t => {
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const basic = h.document.querySelector('[data-pill-removable]');
  const pills = [...basic.querySelectorAll('.genux-pill')];
  assert.deepEqual(
    pills.map(e => e.dataset.pillColor),
    ['red', 'red-orange', 'orange'],
  );
  assert.ok(pills.every(e => e.classList.contains('ant-tag-filled')));
  assert.equal(pills[0].style.getPropertyValue('--pill-bg'), '#F2BFBF');
  const heading = h.document.querySelector('[data-pill-palette]').previousElementSibling;
  assert.equal(heading.textContent, 'Color sequence · 75% white / 5% black');
  const remaining = pills[2];
  const fill = remaining.style.getPropertyValue('--pill-bg');
  await h.click(pills[1].querySelector('.genux-pill-close'));
  assert.equal(basic.querySelectorAll('.genux-pill').length, 2);
  assert.equal(basic.querySelectorAll('.genux-pill')[1], remaining);
  assert.equal(remaining.style.getPropertyValue('--pill-bg'), fill);
  for (const mode of ['dark', 'light']) {
    await h.act(() => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(remaining.style.getPropertyValue('--pill-bg'), fill);
  }
  await h.act(() => h.setLocale('tr'));
  assert.equal(remaining.style.getPropertyValue('--pill-bg'), fill);
  assert.equal(heading.textContent, 'Renk sırası · %75 beyaz / %5 siyah');
});

test('documentation Select tags retain ordered colors across removal and typed tag insertion', async t => {
  const h = await mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('#select-multiple').closest('.ant-select');
  const pills = [...owner.querySelectorAll('.genux-pill')];
  const initialColors = pills.map(e => e.dataset.pillColor);
  assert.equal(new Set(initialColors).size, 2);
  assert.ok(initialColors.every(Boolean));
  await h.click(pills[0].querySelector('.genux-pill-close'));
  assert.equal(owner.querySelector('.genux-pill'), pills[1]);
  assert.equal(pills[1].dataset.pillColor, initialColors[1]);
  const input = h.document.querySelector('#select-tags');
  const tagOwner = input.closest('.ant-select');
  for (const label of ['First custom label', 'Second custom label']) {
    await h.type(input, label);
    await h.act(async () => {
      input.dispatchEvent(
        new h.window.KeyboardEvent('keydown', {
          key: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
      input.dispatchEvent(
        new h.window.KeyboardEvent('keyup', {
          key: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
        }),
      );
    });
    await h.waitFor(
      () => [...tagOwner.querySelectorAll('.genux-pill-label')].some(e => e.textContent === label),
      `custom label inserted: ${label}; current ${tagOwner.textContent}`,
    );
  }
  const custom = [...tagOwner.querySelectorAll('.genux-pill')];
  const customColors = custom.map(e => e.dataset.pillColor);
  assert.equal(new Set(customColors).size, 2);
  assert.ok(customColors.every(Boolean));
  await h.click(custom[0].querySelector('.genux-pill-close'));
  assert.equal(tagOwner.querySelector('.genux-pill'), custom[1]);
  assert.equal(custom[1].dataset.pillColor, customColors[1]);
});

test('Pill palette derives unique 75/5 colors in the token catalog order with readable ink', async () => {
  const compiled = await build({
    stdin: {
      contents:
        "export * from './docs/src/data/pill-palette';export * from './docs/src/data/button-palette';export * from './docs/src/data/color-system';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const palette = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  assert.deepEqual(palette.pillComposition, { whiteness: 75, blackness: 5 });
  assert.deepEqual(
    palette.generateColorPalette('#BFF2C4', 'light'),
    [
      '#f1fff0',
      '#f0fff0',
      '#f0fff0',
      '#f0fff0',
      '#f0fff1',
      '#bff2c4',
      '#97cc9e',
      '#72a67b',
      '#52805b',
      '#385940',
    ],
    'the user-provided seed retains the installed AntD generator tones',
  );

  const ids = palette.pillColorPresets.map(p => p.value);
  const neutrals = ['grey1', 'grey2', 'grey3', 'black1', 'black2', 'black3'];
  assert.deepEqual(
    ids,
    palette.tokenColorPresets
      .filter(p => p.value !== 'red-repeat' && !neutrals.includes(p.value))
      .map(p => p.value),
  );
  assert.deepEqual(
    palette.pillColorPresets.slice(0, 3).map(p => p.color),
    ['#F2BFBF', '#F2CCBF', '#F2D9BF'],
  );
  assert.equal(new Set(palette.pillColorPresets.map(p => p.color)).size, ids.length);
  assert.equal(
    palette.pillColorPresets.some(p => p.value === 'violet-magenta'),
    false,
  );
  assert.equal(palette.pillColorPresets.length, 17);
  assert.equal(palette.pillColorAt(14).value, 'purple');
  for (const id of neutrals) {
    assert.equal(ids.includes(id), false, `${id} is not a Pill variant`);
    assert.ok(
      palette.tokenColorPresets.some(p => p.value === id),
      `${id} stays in Tokens`,
    );
    assert.ok(
      palette.buttonColorPresets.some(p => p.value === id),
      `${id} stays in Button`,
    );
  }
  assert.equal(palette.pillColorAt(16).value, 'magenta-red');
  assert.equal(palette.pillColorAt(17).value, 'red', 'new labels cycle through chromatic colors');
  for (const p of palette.pillColorPresets)
    assert.ok(palette.contrastRatio(p.color, p.ink) >= 4.5, p.value);
  assert.equal(palette.pillColorAt(ids.length), palette.pillColorAt(0));
  assert.equal(palette.pillColorAt(NaN), palette.pillColorAt(0));
  assert.equal(palette.pillColorAt(-1), palette.pillColorAt(0));
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx', { documentation: true });
  try {
    const shown = [...h.document.querySelectorAll('[data-pill-palette] .genux-pill')];
    assert.deepEqual(
      shown.map(p => p.dataset.pillColor),
      ids,
    );
    assert.ok(shown.every(p => p.classList.contains('ant-tag-filled')));
  } finally {
    await h.dispose();
  }
  const approved = await mountPattern('default', 'docs/src/react/GenUXPill.tsx', {
    children: 'Existing consumer',
    colorIndex: 2,
  });
  try {
    const p = approved.document.querySelector('.genux-pill');
    assert.equal(p.dataset.pillColor, undefined);
    assert.equal(p.style.getPropertyValue('--pill-bg'), '');
  } finally {
    await approved.dispose();
  }
});
