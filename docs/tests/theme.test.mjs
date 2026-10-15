import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const { outputFiles: themeOutput } = await build({
  entryPoints: [fileURLToPath(new URL('../src/theme.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const theme = await import(
  'data:text/javascript;base64,' + Buffer.from(themeOutput[0].text).toString('base64')
);

function environment(t) {
  const dom = new JSDOM('<!doctype html><html></html>', {
    url: 'https://atlas.test/',
    pretendToBeVisual: true,
  });
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
  t.after(() => {
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return dom.window;
}

test('theme preference notifies consumers, persists, syncs storage events and unsubscribes', async t => {
  const window = environment(t);
  let calls = 0;
  const stop = theme.subscribeTheme(() => calls++);
  theme.setTheme('dark');
  assert.equal(theme.getThemeSnapshot(), 'dark');
  assert.equal(window.localStorage.getItem(theme.THEME_STORAGE_KEY), 'dark');
  assert.equal(calls, 1);
  assert.equal(window.document.documentElement.dataset.themePaint, 'atomic');
  window.dispatchEvent(
    new window.StorageEvent('storage', { key: theme.THEME_STORAGE_KEY, newValue: 'light' }),
  );
  assert.equal(theme.getThemeSnapshot(), 'light');
  assert.equal(calls, 2);
  stop();
  theme.setTheme('dark');
  assert.equal(calls, 2);
  assert.equal(window.document.documentElement.dataset.themePaint, 'atomic');
  await new Promise(resolve =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
  );
  assert.equal(window.document.documentElement.dataset.themePaint, undefined);
});

test('theme switch works when storage access is blocked and retains a deterministic SSR snapshot', async t => {
  const window = environment(t);
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new Error('Storage blocked');
    },
  });
  assert.doesNotThrow(() => theme.setTheme('dark'));
  assert.equal(theme.getThemeSnapshot(), 'dark');
  assert.equal(theme.getServerThemeSnapshot(), 'light');
  assert.equal(window.document.documentElement.dataset.themePaint, 'atomic');
  await new Promise(resolve =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
  );
  assert.equal(window.document.documentElement.dataset.themePaint, undefined);
});

test('dark action text remains readable at the accepted 0.9 resting opacity', () => {
  const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(part => parseInt(part, 16));
  const luminance = color =>
    color
      .map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const background = rgb(theme.themeColors.dark.panel);
  const foreground = rgb(theme.themeColors.dark.actionInk).map(
    (channel, index) => channel * 0.9 + background[index] * 0.1,
  );
  const contrast = (luminance(foreground) + 0.05) / (luminance(background) + 0.05);
  assert.ok(contrast >= 4.5, `Dark action contrast ${contrast.toFixed(2)}:1`);
});

test('dark surfaces are neutral greys and input backgrounds are darker than their panel', () => {
  const dark = theme.themeColors.dark;
  const channel = hex => {
    const values = hex
      .slice(1)
      .match(/.{2}/g)
      .map(value => parseInt(value, 16));
    assert.equal(values.length, 3);
    assert.equal(values[0], values[1], `Non-neutral surface ${hex}`);
    assert.equal(values[1], values[2], `Non-neutral surface ${hex}`);
    return values[0];
  };
  for (const key of ['paper', 'panel', 'surface', 'ink', 'muted', 'line', 'fieldBorder', 'soft'])
    channel(dark[key]);
  for (const key of ['fieldBg', 'fieldFilledBg', 'fieldHoverBg'])
    assert.ok(channel(dark[key]) < channel(dark.panel), `${key} must be darker than panel`);
  // The requested dark boundaries sit below each adjacent surface, including on hover.
  for (const key of ['fieldBg', 'fieldFilledBg', 'fieldHoverBg', 'panel'])
    assert.ok(
      channel(dark.fieldBorder) < channel(dark[key]),
      `Field border must be darker than ${key}`,
    );
  for (const key of ['paper', 'panel', 'surface'])
    assert.ok(channel(dark.line) < channel(dark[key]), `Divider must be darker than ${key}`);
});

test('field fills are opaque neutral greys below both the page and panel in each theme', () => {
  const rgb = hex => {
    assert.match(hex, /^#[a-f\d]{6}$/i, `Opaque field token required: ${hex}`);
    return hex
      .slice(1)
      .match(/.{2}/g)
      .map(value => parseInt(value, 16));
  };
  for (const [mode, colors] of Object.entries(theme.themeColors)) {
    for (const key of ['fieldBg', 'fieldFilledBg', 'fieldHoverBg']) {
      const fill = rgb(colors[key]);
      assert.equal(fill[0], fill[1], `${mode}: neutral ${key}`);
      assert.equal(fill[1], fill[2], `${mode}: neutral ${key}`);
      for (const parent of ['paper', 'panel'])
        assert.ok(
          fill.every((channel, index) => channel < rgb(colors[parent])[index]),
          `${mode}: ${key} must be below ${parent}`,
        );
    }
  }
});

test('theme builder shadow and density edits reach the legacy CSS aliases', async () => {
  // The model has relative TS and JSON imports, so it is bundled in memory before import.
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL('../src/theme-builder/model.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
  });
  const model = await import(
    'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
  );
  const resolve = recipe => model.resolveThemeBuilder(recipe, 'light');
  const base = resolve(model.createDefaultRecipe()).variables;
  // Each elevation edit must reach the legacy recipe its consumers still read.
  for (const [id, alias, next] of [
    ['shadow-sm', '--shadow-contact', 10],
    ['shadow-md', '--shadow-soft', 16],
    ['shadow-lg', '--shadow-raised', 24],
  ]) {
    const recipe = model.createDefaultRecipe();
    recipe.light[id] = next;
    const css = `--${id}`;
    const edited = resolve(recipe).variables;
    assert.notEqual(edited[css], base[css], `${id} edit must change ${css}`);
    assert.equal(edited[alias], edited[css], `${alias} must follow the edited ${id}`);
    assert.equal(base[alias], base[css], `${alias} must follow the default ${id}`);
  }
  const px = value => {
    assert.match(String(value), /^\d+(?:\.\d+)?px$/, `Spacing alias must be px: ${value}`);
    return parseFloat(value);
  };
  const gaps = ['--field-gap-dense', '--field-gap-compact', '--field-gap', '--section-gap'];
  const withDensity = choice => {
    const recipe = model.createDefaultRecipe();
    recipe.light.density = choice;
    return resolve(recipe);
  };
  const compact = withDensity('compact');
  const comfortable = withDensity('comfortable');
  for (const { variables } of [compact, comfortable]) {
    const values = gaps.map(name => px(variables[name]));
    for (let index = 1; index < values.length; index += 1)
      assert.ok(
        values[index - 1] <= values[index],
        `${gaps[index - 1]} must not exceed ${gaps[index]}`,
      );
  }
  for (const name of gaps)
    assert.ok(
      px(comfortable.variables[name]) > px(compact.variables[name]),
      `${name} must follow the density choice`,
    );
  // Density moves space only: control heights and readable text stay fixed.
  for (const name of [
    '--atlas-size-sm',
    '--atlas-size-md',
    '--atlas-size-lg',
    '--font-size-body',
    '--font-size-label',
    '--font-size-helper',
    '--font-size-table',
    '--text-section',
    '--text-title',
  ])
    assert.equal(
      comfortable.variables[name],
      compact.variables[name],
      `${name} must ignore density`,
    );
  assert.equal(comfortable.token.controlHeight, compact.token.controlHeight);
  assert.equal(comfortable.token.fontSize, compact.token.fontSize);
  assert.ok(px(compact.variables['--font-size-body']) >= 14);
});
