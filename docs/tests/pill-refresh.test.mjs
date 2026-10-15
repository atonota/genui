import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

test('Pill surfaces honor native variant and explicit semantic color without forcing palette red', async t => {
  const h = await mountPattern('default', 'docs/src/react/AtlasPill.tsx', {
    children: 'Success',
    variant: 'outlined',
    color: 'success',
    colorIndex: 0,
  });
  t.after(() => h.dispose());
  const pill = h.document.querySelector('.atlas-pill');
  assert.ok(pill.classList.contains('ant-tag-outlined'));
  assert.ok(pill.classList.contains('ant-tag-success'));
  assert.equal(
    pill.dataset.pillColor,
    undefined,
    'explicit semantic color wins over a palette index',
  );
});

test('Pill catalog exposes distinct surface/status/preset/icon/interaction combinations', async t => {
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  for (const surface of ['filled', 'solid', 'outlined']) {
    const status = h.document.querySelector(`[data-pill-status="${surface}"]`);
    assert.ok(status, surface);
    assert.equal(status.querySelectorAll('.atlas-pill').length, 5);
    assert.ok(
      [...status.querySelectorAll('.atlas-pill')].every(p => p.dataset.pillVariant === surface),
    );
    assert.equal(
      h.document.querySelector(`[data-pill-presets="${surface}"]`).querySelectorAll('.atlas-pill')
        .length,
      17,
    );
  }
  assert.ok(h.document.querySelector('[data-pill-icons] svg'));
  const preview = h.document.querySelector('.pill-playground .atlas-pill');
  assert.equal(preview.dataset.pillColor, undefined);
  assert.notEqual(
    preview.style.getPropertyValue('--pill-bg'),
    '#F2BFBF',
    'unassigned filled inherits theme rather than palette red',
  );
  const semantic = [...h.document.querySelectorAll('.pill-semantic-group .atlas-pill-label')].map(
    node => node.parentElement,
  );
  assert.equal(semantic.length, 2);
  assert.ok(
    semantic.every(node => node.style.fontStyle === 'italic'),
    'native object/function semantic styles reach content slots',
  );

  const check = h.document.querySelector('[data-pill-checkable] [role="checkbox"]');
  assert.ok(check);
  assert.equal(check.getAttribute('aria-checked'), 'true');
  await h.click(check);
  assert.equal(check.getAttribute('aria-checked'), 'false');
  await h.act(() =>
    check.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(check.getAttribute('aria-checked'), 'true');
  await h.act(() =>
    check.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: ' ',
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(check.getAttribute('aria-checked'), 'true', 'held Space does not toggle repeatedly');
  const disabled = h.document.querySelector('[data-pill-checkable] [aria-disabled="true"]');
  const before = disabled.getAttribute('aria-checked');
  await h.click(disabled);
  assert.equal(disabled.getAttribute('aria-checked'), before);
});

test('all managed Pill colors have readable ink on both theme surfaces and reject prototype lookups', async () => {
  const { build } = await import('esbuild');
  const result = await build({
    stdin: {
      contents:
        "export * from './docs/src/data/pill-surfaces';export * from './docs/src/data/color-system';export * from './docs/src/data/pill-palette';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const m = await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
  for (const surface of ['#FFFFFC', '#292929'])
    for (let index = 0; index < 17; index++)
      for (const variant of m.pillVariants) {
        const paint = m.indexedPillPaint(index, variant, surface);
        const background = paint.background === 'transparent' ? surface : paint.background;
        assert.ok(m.contrastRatio(paint.ink, background) >= 4.5, `${index}/${variant}/${surface}`);
        if (variant === 'outlined') assert.ok(m.contrastRatio(paint.border, surface) >= 3);
      }
  for (const color of ['constructor', 'toString', '__proto__', 'unknown-color'])
    assert.equal(m.pillSeed(color, '#0099ff', { success: '#00ff00' }), undefined);
});

test('native root semantic object/function paint overrides managed defaults while explicit style remains last', async t => {
  const h = await mountPattern('default', 'docs/tests/fixtures/PillSemantics.tsx');
  t.after(() => h.dispose());
  const object = h.document.querySelector('[data-case="object"]');
  assert.equal(object.style.backgroundColor, 'rgb(18, 52, 86)');
  assert.equal(object.style.color, 'rgb(255, 255, 255)');
  assert.equal(object.style.borderColor, 'rgb(171, 205, 239)');
  assert.equal(
    h.document.querySelector('[data-case="function"]').style.backgroundColor,
    'rgb(35, 69, 103)',
  );
  assert.equal(
    h.document.querySelector('[data-case="style"]').style.backgroundColor,
    'rgb(52, 86, 120)',
  );
  assert.equal(
    h.document.querySelector('[data-case="managed"]').style.color,
    'var(--pill-ink)',
    'managed HEX paint replaces native low-contrast custom-color ink',
  );
});

test('icon-only Checkable Pill has its own accessible name and native controlled selection', async t => {
  const h = await mountPattern('default', 'docs/src/react/PillDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const icon = h.document.querySelector('[data-pill-checkable] [aria-label="Favorite"]');
  assert.equal(icon.getAttribute('role'), 'checkbox');
  assert.ok(icon.querySelector('svg[data-icon-name="star"]'));
  assert.equal(icon.getAttribute('aria-checked'), 'false');
  await h.click(icon);
  assert.equal(icon.getAttribute('aria-checked'), 'true');
  assert.equal(icon.querySelectorAll('button,input,[role="button"]').length, 0);
});
