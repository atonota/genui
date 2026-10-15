import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import { build } from 'esbuild';
import { mountPattern } from './harness.mjs';

const entry = 'docs/src/react/SliderDemo.tsx';
const slider = (h, name) =>
  [...h.document.querySelectorAll('[role="slider"]')].find(node => {
    const label =
      node.getAttribute('aria-label') ??
      (node.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map(id => h.document.getElementById(id)?.textContent ?? '')
        .join(' ');
    return label === name;
  });
const labelledControl = (h, text) => {
  const label = [...h.document.querySelectorAll('label')].find(
    node => node.textContent.trim() === text,
  );
  return h.document.getElementById(label?.htmlFor ?? '');
};
const numeric = (h, text) => {
  const label = [...h.document.querySelectorAll('label')].find(node => node.textContent === text);
  assert.ok(label, text);
  return h.document.getElementById(label.htmlFor);
};
const key = (h, node, value) =>
  h.act(() =>
    node.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: value,
        keyCode: { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 }[
          value
        ],
        bubbles: true,
        cancelable: true,
      }),
    ),
  );

test('Atlas Slider exposes native single, range, vertical and reverse semantics with distinct handle names', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  for (const name of [
    'Linear value',
    'Range start',
    'Range end',
    'Vertical value',
    'Reversed value',
  ]) {
    assert.ok(slider(h, name), name);
    assert.ok(slider(h, name).closest('.atlas-slider'));
  }
  assert.equal(slider(h, 'Vertical value').getAttribute('aria-orientation'), 'vertical');
  const first = slider(h, 'Range start');
  const last = slider(h, 'Range end');
  const start = Number(first.getAttribute('aria-valuenow'));
  const end = last.getAttribute('aria-valuenow');
  await key(h, first, 'ArrowRight');
  assert.equal(Number(first.getAttribute('aria-valuenow')), start + 1);
  assert.equal(last.getAttribute('aria-valuenow'), end);
  const vertical = slider(h, 'Vertical value');
  const before = Number(vertical.getAttribute('aria-valuenow'));
  await key(h, vertical, 'ArrowUp');
  assert.equal(Number(vertical.getAttribute('aria-valuenow')), before + 1);
});

test('Integer and decimal Slider number inputs share state immediately in both directions', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const integer = numeric(h, 'Integer value');
  const decimal = numeric(h, 'Decimal value');
  await h.type(integer, '11');
  assert.equal(slider(h, 'Integer value').getAttribute('aria-valuenow'), '11');
  await key(h, slider(h, 'Integer value'), 'ArrowRight');
  assert.equal(integer.value, '12');
  await h.type(decimal, '0.47');
  assert.equal(slider(h, 'Decimal value').getAttribute('aria-valuenow'), '0.47');
  await key(h, slider(h, 'Decimal value'), 'ArrowRight');
  assert.equal(Number(decimal.value), 0.48);
});

test('Reversed values, disable and locale changes preserve Slider values and mounted controls', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const reversed = slider(h, 'Reversed value');
  const current = reversed.getAttribute('aria-valuenow');
  assert.ok(reversed.style.right, 'the separate reverse example uses the native reversed axis');
  assert.equal(reversed.getAttribute('aria-valuenow'), current);
  const locked = slider(h, 'Disabled value');
  const value = locked.getAttribute('aria-valuenow');
  const disableToggle = labelledControl(h, 'Disable sliders');
  assert.equal(locked.getAttribute('aria-disabled'), 'true');
  await key(h, locked, 'ArrowRight');
  assert.equal(locked.getAttribute('aria-valuenow'), value);
  await h.click(disableToggle);
  assert.notEqual(locked.getAttribute('aria-disabled'), 'true');
  await key(h, locked, 'ArrowRight');
  assert.equal(Number(locked.getAttribute('aria-valuenow')), Number(value) + 1);
  await h.click(disableToggle);
  assert.equal(locked.getAttribute('aria-disabled'), 'true');
  const integer = numeric(h, 'Integer value');
  await h.type(integer, '11');
  await h.act(() => h.setLocale('tr'));
  assert.equal(h.document.getElementById(integer.id), integer);
  assert.equal(integer.value, '11');
  assert.equal(h.document.contains(reversed), true);
  assert.equal(reversed.getAttribute('aria-valuenow'), current);
});

test('Off-step numeric drafts cannot diverge from the committed Slider and output values', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const decimal = numeric(h, 'Decimal value');
  await h.act(() => decimal.focus());
  await h.type(decimal, '0.475');
  assert.equal(decimal.value, '0.475');
  assert.equal(slider(h, 'Decimal value').getAttribute('aria-valuenow'), '0.47');
  assert.match(decimal.closest('.slider-demo-field').querySelector('output').textContent, /0\.47/);
  await h.act(() => decimal.blur());
  assert.equal(Number(decimal.value), 0.48);
  assert.equal(slider(h, 'Decimal value').getAttribute('aria-valuenow'), '0.48');
  const integer = numeric(h, 'Integer value');
  await h.act(() => integer.focus());
  await h.type(integer, '1.5');
  assert.equal(slider(h, 'Integer value').getAttribute('aria-valuenow'), '11');
  await key(h, integer, 'Enter');
  assert.equal(Number(integer.value), 2);
  assert.equal(slider(h, 'Integer value').getAttribute('aria-valuenow'), '2');
});

test('Master Slider keeps radio-sized thumbs, stable targets and explicit symmetric child motion', async () => {
  const source = await readFile(new URL('../src/styles/slider.css', import.meta.url), 'utf8');
  const css = postcss.parse(source);
  let radioAlias = false;
  let focusMarker = false;
  css.walkDecls(decl => {
    if (decl.prop.startsWith('--') && decl.value.includes('var(--radio-size')) radioAlias = true;
    if (decl.prop === 'border-block-end-color' && decl.parent.selector?.includes(':focus-visible'))
      focusMarker = true;
    if (
      decl.prop.startsWith('transition') &&
      !decl.parent.parent.params?.includes('reduced-motion')
    )
      assert.doesNotMatch(decl.value, /\ball\b|\blinear\b|\bease-out\b|\bease-in\b/);
  });
  assert.ok(radioAlias, 'the master derives the actual Radio size token');
  assert.ok(focusMarker, 'one non-surrounding keyboard marker is required');
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /var\(--motion-easing\)/);
});

test('Slider thumb edge and selected track retain non-text contrast in both documentation themes', async () => {
  const built = await build({
    stdin: {
      contents:
        "export {docsBrandColors} from './docs/src/data/docs-brand.ts'; export {themeColors} from './docs/src/theme.ts'; export {contrastRatio} from './docs/src/data/color-system.ts';",
      resolveDir: new URL('../..', import.meta.url).pathname,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { docsBrandColors, themeColors, contrastRatio } = await import(
    'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
  );
  const source = await readFile(new URL('../src/styles/slider.css', import.meta.url), 'utf8');
  assert.match(source, /--slider-thumb-edge: var\(--accent\)/);
  assert.match(source, /--slider-rail-color: var\(--field-bg\)/);
  assert.match(source, /--slider-track-color: var\(--accent\)/);
  for (const mode of ['light', 'dark']) {
    assert.ok(
      contrastRatio(docsBrandColors[mode].accent, themeColors[mode].panel) >= 3,
      mode + ' thumb',
    );
    assert.ok(
      contrastRatio(docsBrandColors[mode].accent, themeColors[mode].fieldBg) >= 3,
      mode + ' track',
    );
  }
});
