import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

test('atomic input motion overrides the actual Provider inline properties without delaying focus paint', async t => {
  const { mountPattern } = await import('./harness.mjs');
  const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const owner = h.document.querySelector('.genux-demo[data-genux-appearance="docs"]');
  h.document.body.dataset.genuxSurface = 'docs';
  const input = h.document.querySelector('#input-filled');
  const nativeOwner = input.closest('.ant-input-affix-wrapper') ?? input;
  const property = '--docs-input-transition-properties';
  assert.match(owner.style.getPropertyValue(property), /background-color/);
  assert.doesNotMatch(owner.style.getPropertyValue(property), /box-shadow/);
  h.document.documentElement.dataset.themePaint = 'atomic';
  const css = postcss.parse(await readFile('docs/src/styles/docs-accessibility.css', 'utf8'));
  let override;
  css.walkRules(rule => {
    if (
      !rule.selector.includes("[data-theme-paint='atomic']") ||
      !nativeOwner.matches(rule.selector)
    )
      return;
    rule.walkDecls(property, declaration => {
      override = declaration;
    });
  });
  assert.ok(
    override?.important,
    'the same Provider owner needs an important override of its inline value',
  );
  assert.doesNotMatch(override.value, /color|background|border|box-shadow/);
  assert.match(override.value, /opacity/);
  delete h.document.documentElement.dataset.themePaint;
  assert.equal(h.document.documentElement.hasAttribute('data-theme-paint'), false);
});

test('theme paint updates atomically while semantic state and normal motion stay immediate', async t => {
  const compiled = await build({
    stdin: {
      contents: "export * from './docs/src/theme';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const dom = new JSDOM('<html data-theme="light"><body data-genux-surface="docs"></body></html>', {
    url: 'https://genux.test',
  });
  const saved = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
    }
  });
  const frames = [];
  dom.window.requestAnimationFrame = callback => frames.push(callback);
  const theme = await import(
    'data:text/javascript;base64,' +
      Buffer.from(compiled.outputFiles[0].contents).toString('base64')
  );
  let announced;
  theme.subscribeTheme(() => {
    announced = theme.getThemeSnapshot();
  });
  theme.setTheme('dark');
  assert.equal(announced, 'dark');
  assert.equal(dom.window.document.documentElement.dataset.theme, 'dark');
  assert.equal(
    dom.window.document.documentElement.dataset.themePaint,
    'atomic',
    'paint guard precedes a visible palette flip',
  );
  frames.shift()();
  assert.equal(
    dom.window.document.documentElement.dataset.themePaint,
    'atomic',
    'keep paint atomic through native and React CSS-variable commit',
  );
  frames.shift()();
  assert.equal(dom.window.document.documentElement.dataset.themePaint, undefined);
  theme.setTheme('light');
  const stale = frames.shift();
  theme.setTheme('dark');
  stale();
  assert.equal(
    dom.window.document.documentElement.dataset.themePaint,
    'atomic',
    'interrupted flips retain the current guard',
  );
  while (frames.length) frames.shift()();
  assert.equal(dom.window.document.documentElement.dataset.themePaint, undefined);
  const css = postcss.parse(await readFile('docs/src/styles/docs-accessibility.css', 'utf8'));
  let rule;
  css.walkRules(candidate => {
    if (candidate.selector.includes("[data-theme-paint='atomic']")) rule = candidate;
  });
  assert.ok(rule, 'guard is scoped to documentation paint only');
  assert.match(rule.selector, /body\[data-genux-surface='docs'\]/);
  const properties = rule.nodes.find(n => n.prop === 'transition-property')?.value;
  assert.ok(properties);
  assert.doesNotMatch(properties, /\b(?:color|background|border-color|all|none)\b/);
  assert.match(properties, /transform/);
  assert.ok(
    !rule.nodes.some(n => ['transition-duration', 'animation-duration'].includes(n.prop)),
    'positive motion durations stay intact',
  );
});

test('independent Color preview mode commits share atomic paint without changing the outer theme', async t => {
  const { mountPattern } = await import('./harness.mjs');
  const h = await mountPattern('default', 'docs/src/react/color/ColorSystemDemo.tsx');
  t.after(() => h.dispose());
  h.document.body.dataset.genuxSurface = 'docs';
  const frames = [];
  h.window.requestAnimationFrame = callback => frames.push(callback);
  const outer = h.document.documentElement.dataset.theme;
  const field = h.document.querySelector('.color-seed-preview input[type="text"]');
  await h.type(field, 'Retained preview draft');
  for (const mode of ['Dark', 'Light']) {
    const label = [...h.document.querySelectorAll('.ant-segmented-item')].find(
      node => node.textContent === mode,
    );
    await h.click(label);
    assert.equal(
      h.document.documentElement.dataset.themePaint,
      'atomic',
      `${mode} guards palette commit`,
    );
    assert.equal(
      h.document.documentElement.dataset.theme,
      outer,
      'local mode does not change the outer theme',
    );
    assert.equal(field.value, 'Retained preview draft');
    while (frames.length) frames.shift()();
    assert.equal(h.document.documentElement.dataset.themePaint, undefined);
  }
  for (const preset of ['black3', 'yellow']) {
    const input = [...h.document.querySelectorAll('.color-presets input')].find(
      node => node.value === preset,
    );
    await h.click(input);
    assert.equal(
      h.document.documentElement.dataset.themePaint,
      'atomic',
      `${preset} guards seed palette commit`,
    );
    assert.equal(field.value, 'Retained preview draft');
    while (frames.length) frames.shift()();
    assert.equal(h.document.documentElement.dataset.themePaint, undefined);
  }
});
