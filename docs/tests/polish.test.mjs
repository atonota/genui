import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';
import { mountPattern, buttonByText } from './harness.mjs';

test('documentation flat buttons have no border reservation, including disabled Quantity actions', async t => {
  const sheet = postcss.parse(
    await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  );
  let flat;
  sheet.walkRules(rule => {
    if (rule.selector === ".genux-demo[data-genux-appearance='docs']") flat = rule;
  });
  assert.ok(
    flat,
    'flat documentation actions must remove the dark one-pixel edge, not just make its border transparent',
  );
  assert.equal(flat.nodes.find(node => node.prop === '--button-border-width')?.value, '0px');
  const h = await mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const actions = [...h.document.querySelectorAll('.genux-number-stepper .genux-button')];
  assert.equal(actions.length, 4);
  assert.ok(
    actions.some(action => action.disabled),
    'read-only actions stay disabled',
  );
  for (const action of actions) assert.ok(action.closest('.genux-demo').matches(flat.selector));
  const base = sheet.nodes.find(rule => rule.selector === '.genux-demo');
  const value = (rule, name) => rule.nodes.find(node => node.prop === name)?.value;
  assert.equal(value(base, '--button-outline-border-width'), '1px');
  assert.equal(value(base, '--button-border-width'), 'var(--button-outline-border-width)');
  const approved = h.document.createElement('div');
  approved.className = 'genux-demo';
  const nestedDocs = h.document.createElement('div');
  nestedDocs.className = 'genux-demo';
  nestedDocs.dataset.genuxAppearance = 'docs';
  const approvedAction = h.document.createElement('button');
  const docsAction = h.document.createElement('button');
  approved.append(approvedAction, nestedDocs);
  nestedDocs.append(docsAction);
  h.document.querySelector('.genux-demo').append(approved);
  assert.equal(approvedAction.closest('.genux-demo').matches(flat.selector), false);
  assert.equal(docsAction.closest('.genux-demo').matches(flat.selector), true);
  const outline = h.document.createElement('button');
  outline.className = 'ant-btn genux-button genux-button-outlined';
  h.document.querySelector('.genux-demo').append(outline);
  let framed;
  sheet.walkRules(rule => {
    if (rule.selector.includes('.genux-button-outlined') && outline.matches(rule.selector))
      framed = rule;
  });
  assert.equal(
    value(framed, '--button-border-width'),
    'var(--button-outline-border-width)',
    'the explicit Outline surface retains its boundary',
  );
});

test('docs Button press and release finish 30 percent faster than the previous one-third profile, below Switch motion', async () => {
  const motion = JSON.parse(
    await readFile(new URL('../src/data/motion.json', import.meta.url), 'utf8'),
  );
  const duration = motion.durationMs['button-feedback'];
  assert.ok(duration > 0, 'Button feedback needs a positive central duration');
  assert.ok(Math.abs(duration - (motion.durationMs.deliberate / 3) * 0.7) < 0.001);
  assert.ok(duration <= motion.durationMs.selection, 'Button feedback must not exceed Switch');
  const layout = await readFile(
    new URL('../src/layouts/DocsLayout.astro', import.meta.url),
    'utf8',
  );
  assert.match(layout, /<body data-genux-surface="docs">/);
  const sheet = postcss.parse(
    await readFile(new URL('../src/styles/web.css', import.meta.url), 'utf8'),
  );
  const selector = "body[data-genux-surface='docs'] .genux-demo .genux-button";
  let adapter;
  sheet.walkRules(rule => {
    if (rule.selector === selector) adapter = rule;
  });
  assert.ok(adapter, 'docs-body scope also reaches portalled actions and excludes Storybook');
  for (const prop of ['--button-duration', '--press-duration', '--release-duration']) {
    const declaration = adapter.nodes.find(node => node.prop === prop);
    assert.equal(declaration?.value, 'var(--motion-duration-button-feedback)', prop);
    assert.ok(declaration.important, `${prop}: override the shared inline 500 ms default`);
  }
  const shared = postcss.parse(
    await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  );
  const owners = new Map([
    ['.genux-demo .ant-btn', ['opacity', 'box-shadow']],
    ['.genux-demo :is(.ant-btn-primary, .genux-button)::before', ['inset']],
    ['.genux-demo .genux-button-lip::before', ['height']],
    ['.genux-demo .genux-button-lip::after', ['height']],
  ]);
  for (const [owner, properties] of owners) {
    let transition;
    shared.walkRules(rule => {
      if (rule.selectors.includes(owner))
        transition ??= rule.nodes.find(node => node.prop === 'transition')?.value;
    });
    for (const property of properties)
      assert.ok(
        transition?.includes(`${property} var(--release-duration) var(--motion-easing)`),
        `${owner}: ${property} must use the capped release duration`,
      );
  }
  let pressedOwners = 0;
  shared.walkRules(rule => {
    if (rule.selector.includes("[data-pressed='true']")) {
      const duration = rule.nodes.find(node => node.prop === 'transition-duration');
      if (duration) {
        assert.equal(duration.value, 'var(--press-duration)');
        pressedOwners++;
      }
    }
  });
  assert.equal(pressedOwners, 4, 'root, solid face and both transparent lip layers use fast entry');
  assert.equal(motion.easing, 'cubic-bezier(0.65, 0, 0.35, 1)');
  assert.equal(motion.delayMs, 0);
  let reduced;
  shared.walkAtRules('media', media => {
    if (media.params !== '(prefers-reduced-motion: reduce)') return;
    media.walkDecls('transition-duration', declaration => {
      reduced = declaration;
    });
  });
  assert.equal(reduced?.value, '0s');
  assert.ok(reduced.important, 'reduced motion must still win over fast Button feedback');
  const renderer = await readFile(new URL('../src/react/GenUXButton.tsx', import.meta.url), 'utf8');
  for (const prop of ['--button-duration', '--press-duration', '--release-duration'])
    assert.ok(renderer.includes(`'${prop}': 'var(--motion-duration-deliberate)'`));
});

test('Drawer action uses the shared Button renderer', async t => {
  const h = await mountPattern('DrawerExamples');
  t.after(() => h.dispose());
  assert.equal(buttonByText(h.document, 'Open panel').classList.contains('genux-button'), true);
});

test('web Button copy describes fast press and release feedback', async t => {
  const web = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx');
  t.after(() => web.dispose());
  assert.match(web.document.body.textContent, /Web Button press and release: 116\.667 ms/);
  assert.equal(
    web.document.querySelector('label[for="button-duration"]').textContent,
    'Base transition duration · approved',
  );
});

test('the default Button gallery retains its base duration copy', async t => {
  const shared = await mountPattern(
    'ButtonVisualDecisions',
    'docs/src/react/ButtonVisualDecisions.tsx',
  );
  t.after(() => shared.dispose());
  assert.match(shared.document.body.textContent, /Shared transition duration: 500 ms/);
  assert.doesNotMatch(shared.document.body.textContent, /Web Button press and release/);
});

test('web number stepper exposes one visible shared surface and removes the nested field shadow', async () => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/web.css', import.meta.url), 'utf8'),
  );
  const rules = [];
  css.walkRules(rule => rules.push(rule));
  const wrapper = rules.find(
    rule => rule.selector === '.live-preview .genux-demo .genux-number-stepper',
  );
  const declarations = rule => Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
  assert.match(
    declarations(wrapper).background ?? declarations(wrapper)['background-color'] ?? '',
    /var\(--(?:field-bg|surface)\)/,
  );
  assert.match(declarations(wrapper).padding ?? '', /var\(--/);
  const field = rules.find(
    rule => rule.selector === '.live-preview .genux-demo .genux-number-stepper > .ant-input-number',
  );
  assert.equal(declarations(field)['box-shadow'], 'none');
  assert.equal(
    declarations(field).background ?? declarations(field)['background-color'],
    'transparent',
  );
  assert.ok(
    field.nodes.find(node => ['background', 'background-color'].includes(node.prop))?.important,
    'the nested field stays transparent against the shared important normal/hover fill',
  );
});

test('Pill native close hides the master surface despite its flex display', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXPill.tsx', {
    children: 'Removable tag',
    closable: true,
  });
  t.after(() => h.dispose());
  const pill = h.document.querySelector('.genux-pill');
  await h.click(pill.querySelector('.genux-pill-close'));
  assert.ok(pill.classList.contains('ant-tag-hidden'), 'native Tag owns successful closing');
  const css = postcss.parse(
    await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  );
  let display;
  css.walkRules(rule => {
    if (rule.selector === '.genux-demo .genux-pill.ant-tag-hidden')
      display = rule.nodes.find(node => node.prop === 'display')?.value;
  });
  assert.equal(display, 'none', 'native hidden class must beat the master flex display');
});

test('transparent middle Button fills preserve light colours and use readable dark foregrounds', async t => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  );
  let darkInk;
  css.walkRules(rule => {
    if (rule.selector === ":root[data-theme='dark'] .genux-demo .genux-button")
      darkInk = rule.nodes.find(node => node.prop === '--button-transparent-ink')?.value;
  });
  assert.equal(darkInk, 'var(--button-outline-ink)');
  const luminance = rgb =>
    rgb.reduce((sum, channel, index) => {
      const value = channel / 255;
      const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  for (const [fill, lightInk] of [
    ['outline', '#a8071a'],
    ['text', '#a8071a'],
    ['link', '#a8071a'],
  ]) {
    await t.test(fill, async t => {
      const h = await mountPattern('default', 'docs/src/react/GenUXButton.tsx', { fill });
      t.after(() => h.dispose());
      const button = h.document.querySelector('.genux-button');
      assert.equal(
        Boolean(button.querySelector('.genux-button-lip[aria-hidden="true"]')),
        fill === 'outline',
        'text and link remain flat; outline retains the tactile layer',
      );
      assert.equal(button.style.getPropertyValue('--button-text'), 'var(--button-transparent-ink)');
      assert.equal(button.style.getPropertyValue('--button-transparent-light-ink'), lightInk);
      const dark = button.style.getPropertyValue('--button-outline-ink');
      const foreground = dark
        .match(/[a-f\d]{2}/gi)
        .map(part => parseInt(part, 16) * 0.9 + 44 * 0.1);
      const ratio = (luminance(foreground) + 0.05) / (luminance([44, 44, 44]) + 0.05);
      assert.ok(ratio >= 4.5, `${fill}: resting dark foreground contrast ${ratio.toFixed(2)}:1`);
    });
  }
});

test('fields expose subtle inset depth and reversible placeholder opacity without changing their border box', async () => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/web.css', import.meta.url), 'utf8'),
  );
  const rules = [];
  css.walkRules(rule => rules.push(rule));
  const tokens = rules.find(rule => rule.selector === '.live-preview');
  const values = Object.fromEntries(tokens.nodes.map(node => [node.prop, node.value]));
  assert.equal(values['--placeholder-opacity'], '0.7');
  assert.equal(values['--placeholder-active-opacity'], '0.5');
  const insetOwners = rules.filter(rule =>
    rule.nodes.some(node => node.prop === 'box-shadow' && /inset-shadow/.test(node.value)),
  );
  assert.ok(insetOwners.length >= 1);
  assert.ok(
    insetOwners.every(rule => !rule.selector.includes('.ant-select')),
    'Select keeps its separate surface',
  );
  assert.equal(values['--input-radius'], 'var(--radius-sm)');
  assert.ok(
    rules.some(rule =>
      rule.nodes.some(node => node.prop === '--input-inset-shadow' && node.value.includes('inset')),
    ),
  );
  for (const rule of rules) {
    for (const node of rule.nodes.filter(node => node.prop === '--input-inset-shadow')) {
      if (node.value === 'none') continue;
      const layers = [...node.value.matchAll(/inset\s+-?\d+px\s+-?\d+px\s+(\d+)(?:px)?/g)];
      assert.ok(layers.length >= 1);
      assert.ok(
        layers.every(layer => layer[1] === '0'),
        'input depth has no diffuse bevel blur',
      );
    }
  }
  assert.ok(
    rules.some(
      rule =>
        rule.selector.includes('::placeholder') &&
        rule.nodes.some(
          node => node.prop === 'transition' && node.value.includes('var(--motion-easing)'),
        ),
    ),
  );
});
