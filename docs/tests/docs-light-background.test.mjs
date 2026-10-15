import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

const root = resolve(import.meta.dirname, '../..');
const layout = await readFile(resolve(root, 'docs/src/layouts/DocsLayout.astro'), 'utf8');
const themeImport = layout.match(/^import \{ (\w+)(?: as (\w+))? \} from '\.\.\/theme';$/m);
assert.ok(themeImport, 'use the theme stylesheet actually imported by DocsLayout');
const compiled = await build({
  stdin: {
    contents: `${themeImport[0]}
export const layoutThemeStyleText = ${themeImport[2] ?? themeImport[1]};
export * from '../theme';
export {docsAccessibleThemeColors,docsAccessibilityStyleText} from '../data/accessibility';
export {docsBrandColors} from '../data/docs-brand';
export {contrastRatio} from '../data/color-system';`,
    resolveDir: resolve(root, 'docs/src/layouts'),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const theme = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

test('documentation light paper is exact while approved and other surface colors retain their profile', () => {
  assert.equal(theme.docsAccessibleThemeColors.light.paper, '#e6e2d7');
  assert.equal(
    theme.themeColors.light.paper,
    '#f5f3ee',
    'approved/Storybook paper stays unchanged',
  );
  assert.equal(theme.docsAccessibleThemeColors.dark.paper, '#242424');
  for (const mode of ['light', 'dark'])
    for (const key of ['panel', 'surface', 'fieldBg', 'fieldFilledBg', 'fieldHoverBg'])
      assert.equal(theme.docsAccessibleThemeColors[mode][key], theme.themeColors[mode][key]);
});

test('the documentation SSR stylesheet paints exact light paper before bootstrap and without JavaScript', async t => {
  assert.match(layout, /<style is:inline set:html=\{themeStyleText\}/);
  assert.ok(layout.indexOf('set:html={themeStyleText}') < layout.indexOf('data-theme-bootstrap'));
  const css = postcss.parse(await readFile(resolve(root, 'docs/src/styles/docs.css'), 'utf8'));
  let canvasBackground;
  css.walkRules(':root', rule => {
    rule.walkDecls('background', declaration => {
      canvasBackground = declaration.value;
    });
  });
  assert.equal(canvasBackground, 'var(--paper)', 'the canvas keeps its central semantic token');
  for (const mode of [undefined, 'light', 'dark']) {
    const dom = new JSDOM(`<!doctype html><html${mode ? ` data-theme="${mode}"` : ''}>
<head><style>${theme.layoutThemeStyleText}</style></head><body data-atlas-surface="docs"></body></html>`);
    t.after(() => dom.window.close());
    const values = dom.window.getComputedStyle(dom.window.document.documentElement);
    assert.equal(values.getPropertyValue('--paper'), mode === 'dark' ? '#242424' : '#e6e2d7');
    for (const key of ['panel', 'surface', 'fieldBg', 'fieldFilledBg', 'fieldHoverBg'])
      assert.equal(
        values.getPropertyValue(`--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`),
        theme.themeColors[mode ?? 'light'][key],
      );
  }
});

test('the approved stylesheet retains its existing paper independently of documentation', async t => {
  const preview = await readFile(resolve(root, '.storybook/preview.tsx'), 'utf8');
  assert.match(preview, /\bthemeStyleText\b[\s\S]*from '\.\.\/docs\/src\/theme'/);
  assert.doesNotMatch(preview, /docsThemeStyleText/);
  const dom = new JSDOM(
    `<html><head><style>${theme.themeStyleText}</style></head><body></body></html>`,
  );
  t.after(() => dom.window.close());
  assert.equal(
    dom.window.getComputedStyle(dom.window.document.documentElement).getPropertyValue('--paper'),
    '#f5f3ee',
  );
});

test('documentation accessibility roles also apply to the light no-JavaScript fallback', t => {
  for (const mode of [undefined, 'light', 'dark']) {
    const dom = new JSDOM(`<!doctype html><html${mode ? ` data-theme="${mode}"` : ''}>
<head><style>${theme.layoutThemeStyleText}\n${theme.docsAccessibilityStyleText}</style></head>
<body data-atlas-surface="docs"></body></html>`);
    t.after(() => dom.window.close());
    const values = dom.window.getComputedStyle(dom.window.document.body);
    const colors = theme.docsAccessibleThemeColors[mode ?? 'light'];
    assert.equal(values.getPropertyValue('--success'), colors.success);
    assert.equal(values.getPropertyValue('--field-border'), colors.fieldBorder);
    assert.ok(theme.contrastRatio(values.getPropertyValue('--success'), colors.paper) >= 4.5);
  }
});

test('existing documentation foreground roles meet normal-text contrast on the requested light paper', () => {
  const colors = theme.docsAccessibleThemeColors.light;
  for (const [role, foreground] of Object.entries({
    ...Object.fromEntries(
      ['ink', 'muted', 'error', 'warning', 'success'].map(key => [key, colors[key]]),
    ),
    ...Object.fromEntries(
      ['accent', 'accentHover', 'accentActive', 'actionInk'].map(key => [
        key,
        theme.docsBrandColors.light[key],
      ]),
    ),
  })) {
    const ratio = theme.contrastRatio(foreground, '#e6e2d7');
    assert.ok(ratio >= 4.5, `${role} ${foreground} on #e6e2d7: ${ratio.toFixed(3)}:1`);
  }
});
