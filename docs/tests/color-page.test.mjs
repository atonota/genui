import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import { mountPattern, buttonByText } from './harness.mjs';

const entry = 'docs/src/react/color/ColorSystemDemo.tsx';
const hex = h => h.document.querySelector('[data-color-hex]').textContent;
const labelledInput = (h, label) => {
  const owner = [...h.document.querySelectorAll('label')].find(
    node => node.textContent.trim() === label,
  );
  assert.ok(owner, label);
  return h.document.getElementById(owner.htmlFor);
};
async function chooseFile(h, file) {
  const input = h.document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await h.act(async () => {
    input.dispatchEvent(new h.window.Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

async function chooseMethod(h, method) {
  const label = method === 'presets' ? 'Color presets' : 'Detailed selection';
  const item = [...h.document.querySelectorAll('.color-method .ant-segmented-item')].find(
    node => node.textContent === label,
  );
  await h.click(item?.querySelector('input'));
}

test('Color presets are the first default method and fitted grid keyboard navigation follows its column-major placement', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const methods = [...h.document.querySelectorAll('.color-method input')];
  assert.deepEqual(
    [...h.document.querySelectorAll('.color-method .ant-segmented-item-label')].map(
      node => node.textContent,
    ),
    ['Color presets', 'Detailed selection'],
  );
  assert.equal(methods[0].checked, true);
  assert.equal(Number(labelledInput(h, 'Whiteness · percent').value), 15);
  assert.equal(Number(labelledInput(h, 'Blackness · percent').value), 15);
  const viewport = h.document.querySelector('.color-presets-viewport');
  assert.equal(viewport.tabIndex, 0);
  assert.equal(viewport.getAttribute('aria-label'), 'Color presets');
  const radios = [...viewport.querySelectorAll('input[type="radio"]')];
  const key = async name =>
    h.act(() =>
      h.document.activeElement.dispatchEvent(
        new h.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
      ),
    );
  await h.act(() => radios[0].focus());
  await key('ArrowRight');
  assert.equal(h.document.activeElement, radios[13]);
  await key('ArrowDown');
  assert.equal(h.document.activeElement, radios[14]);
  await key('ArrowUp');
  assert.equal(h.document.activeElement, radios[13]);
  await key('End');
  assert.equal(h.document.activeElement, radios.at(-1));
  assert.equal(radios.at(-1).checked, true);
  await key('Home');
  assert.equal(h.document.activeElement, radios[0]);
  await key('ArrowDown');
  await key('ArrowLeft');
  assert.equal(
    h.document.activeElement,
    radios[1],
    'the first column does not switch rows at its left edge',
  );
  await key('End');
  await key('ArrowDown');
  assert.equal(
    h.document.activeElement,
    radios.at(-1),
    'the incomplete final column remains reachable without a phantom row',
  );
  await h.click(buttonByText(h.document, 'Reset color'));
  assert.equal(Number(labelledInput(h, 'Whiteness · percent').value), 15);
  assert.equal(Number(labelledInput(h, 'Blackness · percent').value), 15);
});

test('Stepped ramps gain about seventy percent more equal color steps and share the taller visual contract', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  const ramps = [...h.document.querySelectorAll('.color-spectrum')];
  assert.equal(ramps.length, 4);
  for (const ramp of ramps) {
    assert.equal(ramp.children.length, 41);
    assert.equal(ramp.style.getPropertyValue('--color-spectrum-segments'), '41');
  }
  const sheet = postcss.parse(
    await readFile(new URL('../src/styles/color-system.css', import.meta.url), 'utf8'),
  );
  const tokens = sheet.nodes.find(node => node.selector === '.color-system-lab');
  const token = name => tokens.nodes.find(node => node.prop === name)?.value;
  assert.equal(token('--color-spectrum-height'), '2.25rem');
  assert.equal(token('--color-composition-height'), '3rem');
  let presetGrid;
  sheet.walkRules(rule => {
    if (
      rule.selector === '.color-system-lab .color-presets.ant-radio-group' &&
      rule.parent.type === 'root'
    )
      presetGrid = rule;
  });
  const declaration = name => presetGrid.nodes.find(node => node.prop === name)?.value;
  assert.equal(declaration('--color-preset-rows'), '13');
  assert.equal(
    declaration('grid-template-rows'),
    'repeat(var(--color-preset-rows), minmax(var(--color-preset-height), auto))',
  );
  assert.equal(declaration('width'), '100%');
  assert.equal(declaration('grid-auto-flow'), 'column');
  assert.equal(declaration('grid-auto-columns'), 'minmax(0, 1fr)');
  const wrapper = sheet.nodes.find(
    rule => rule.selector === '.color-system-lab .color-preset.ant-radio-wrapper',
  );
  assert.equal(wrapper.nodes.find(node => node.prop === 'width').value, '100%');
  assert.equal(
    sheet.nodes
      .find(rule => rule.selector === '.color-presets-viewport')
      .nodes.find(node => node.prop === 'overflow-x').value,
    'visible',
  );
  let markerRule;
  sheet.walkRules(rule => {
    if (rule.selector === '.color-composition-marker') markerRule = rule;
  });
  assert.match(markerRule.nodes.find(node => node.prop === 'inset-inline-start').value, /^clamp\(/);
  sheet.walkRules(rule => {
    if (rule.selector.includes('.color-composition-marker'))
      assert.equal(
        rule.nodes.some(node => node.prop === 'margin-inline-start'),
        false,
        'endpoint changes must not jump via separate marker offsets',
      );
  });
});

test('Composition indicators track start, end and effective HWB boundaries without duplicate visible markers', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const markers = () => [...h.document.querySelectorAll('.color-composition-marker')];
  const visible = () => markers().filter(node => node.dataset.visible === 'true');
  assert.equal(markers().length, 4);
  assert.equal(Number(labelledInput(h, 'Whiteness · percent').value), 15);
  assert.equal(Number(labelledInput(h, 'Blackness · percent').value), 15);
  assert.deepEqual(
    visible().map(node => Number(node.dataset.position)),
    [0, 70, 85, 100],
  );
  const original = markers();
  await h.type(labelledInput(h, 'Whiteness · percent'), '80');
  await h.type(labelledInput(h, 'Blackness · percent'), '80');
  assert.deepEqual(
    visible().map(node => Number(node.dataset.position)),
    [0, 50, 100],
  );
  assert.deepEqual(
    markers(),
    original,
    'marker nodes persist during reversal and zero-share transitions',
  );
  for (const marker of markers()) {
    assert.equal(marker.closest('[aria-hidden="true"]')?.className, 'color-composition-visual');
    assert.equal(marker.querySelector('svg').getAttribute('focusable'), 'false');
  }
  await h.type(labelledInput(h, 'Whiteness · percent'), '10');
  await h.type(labelledInput(h, 'Blackness · percent'), '0.1');
  assert.deepEqual(
    visible().map(node => Number(node.dataset.position)),
    [0, 89.9, 99.9, 100],
  );
  assert.deepEqual(markers(), original);
});

test('Color selection methods preserve one seed, preset identity and sample draft', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const name = labelledInput(h, 'Workspace name');
  await h.type(name, 'Retained workspace');
  const initial = hex(h);
  await chooseMethod(h, 'presets');
  assert.equal(hex(h), initial);
  const radios = [...h.document.querySelectorAll('.color-presets input[type="radio"]')];
  assert.equal(radios.length, 24);
  await h.click(radios.find(node => node.value === 'red-repeat'));
  assert.equal(hex(h), '#E01F1F');
  assert.deepEqual(
    radios.filter(node => node.checked).map(node => node.value),
    ['red-repeat'],
  );
  await h.type(labelledInput(h, 'Whiteness · percent'), '25');
  assert.equal(radios.find(node => node.value === 'red-repeat').checked, true);
  const customized = hex(h);
  await chooseMethod(h, 'detailed');
  assert.equal(hex(h), customized);
  await h.click(
    h.document.querySelectorAll('.color-palette .ant-segmented input[type="radio"]')[1],
  );
  assert.equal(hex(h), customized);
  assert.equal(h.document.querySelector('[data-color-seed]').textContent, customized);
  assert.equal(labelledInput(h, 'Workspace name'), name);
  assert.equal(name.value, 'Retained workspace');
});

test('Achromatic color retains independent W/B and a fine hue edit does not silently move its window', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  const main = labelledInput(h, 'Main hue · degrees');
  const fine = labelledInput(h, 'Fine hue · degrees');
  await h.type(main, '5');
  await h.type(fine, '355');
  await h.act(() =>
    fine.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  assert.equal(main.value, '5');
  assert.equal(Number(fine.value), 355);
  await h.type(labelledInput(h, 'Whiteness · percent'), '80');
  await h.type(labelledInput(h, 'Blackness · percent'), '80');
  assert.equal(hex(h), '#808080');
  assert.equal(Number(labelledInput(h, 'Whiteness · percent').value), 80);
  assert.equal(Number(labelledInput(h, 'Blackness · percent').value), 80);
  assert.match(h.document.body.textContent, /your inputs are retained/);
  await h.type(main, '200');
  assert.equal(hex(h), '#808080');
});

test('Color storage failure preserves in-session choices and import rejection preserves the current seed', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  Object.defineProperty(h.window, 'localStorage', {
    get() {
      throw new Error('Blocked');
    },
  });
  await h.type(labelledInput(h, 'Main hue · degrees'), '90');
  const current = hex(h);
  await h.click(buttonByText(h.document, 'Save selection'));
  assert.equal(h.document.querySelectorAll('.color-saved-list li').length, 1);
  assert.match(h.document.body.textContent, /Work continues in this session/);
  await chooseFile(h, { size: 10, text: async () => '{invalid' });
  await h.waitFor(() => h.document.querySelector('[role="alert"]'), 'invalid import result');
  assert.equal(hex(h), current);
  await chooseFile(h, {
    size: 1024 * 1024 + 1,
    text: async () => {
      throw new Error('Must not read oversized file');
    },
  });
  assert.match(h.document.querySelector('[role="alert"]').textContent, /no larger than 1 MiB/);
  assert.equal(hex(h), current);
});

test('Slow color imports cannot overwrite newer manual edits', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  let finish;
  const pending = new Promise(resolve => {
    finish = resolve;
  });
  await chooseFile(h, { size: 300, text: () => pending });
  await h.type(labelledInput(h, 'Main hue · degrees'), '90');
  const current = hex(h);
  await h.act(async () => {
    finish(
      JSON.stringify({
        format: 'hwb-ant-design-controller',
        schemaVersion: 4,
        settings: { anchor: 240, offset: 0, w: 10, b: 18, mode: 'light' },
      }),
    );
    await pending;
  });
  assert.equal(hex(h), current, 'the pending import must not replace the later selection');
});

test('Typing a fine hue commits once and retains the original window for an in-range final value', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  const main = labelledInput(h, 'Main hue · degrees');
  const fine = labelledInput(h, 'Fine hue · degrees');
  const initial = hex(h);
  await h.act(() => fine.focus());
  for (const value of ['2', '21', '218']) await h.type(fine, value);
  assert.equal(main.value, '214', 'intermediate digits must not recenter the fine window');
  assert.equal(hex(h), initial, 'typed digits remain a draft until Enter or blur');
  await h.act(() =>
    fine.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  assert.equal(main.value, '214');
  assert.notEqual(hex(h), initial);
});

test('Color locale changes retain the selection and existing sample input', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const name = labelledInput(h, 'Workspace name');
  await h.type(name, 'Same draft');
  const initial = hex(h);
  await h.act(() => h.setLocale('tr'));
  assert.equal(hex(h), initial);
  assert.equal(h.document.getElementById(name.id), name);
  assert.equal(name.value, 'Same draft');
  assert.match(h.document.body.textContent, /Renk/);
  await h.act(() => h.setLocale('en'));
  assert.equal(labelledInput(h, 'Workspace name'), name);
});

test('Removing the focused last saved color returns keyboard focus to Save selection', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  const save = buttonByText(h.document, 'Save selection');
  await h.click(save);
  const remove = buttonByText(h.document, 'Remove selection 1');
  await h.act(() => remove.focus());
  await h.click(remove);
  assert.equal(h.document.querySelectorAll('.color-saved-list li').length, 0);
  assert.ok(h.document.activeElement === save, 'focus must return to the stable Save action');
  await h.click(save);
  await h.click(save);
  const firstRemove = buttonByText(h.document, 'Remove selection 1');
  await h.act(() => firstRemove.focus());
  await h.click(firstRemove);
  assert.ok(h.document.activeElement === buttonByText(h.document, 'Load selection 1'));
});

test('A pending color import cannot replace an uncommitted fine hue draft', async t => {
  const h = await mountPattern('default', entry);
  t.after(() => h.dispose());
  await chooseMethod(h, 'detailed');
  let finish;
  const pending = new Promise(resolve => {
    finish = resolve;
  });
  await chooseFile(h, { size: 300, text: () => pending });
  const fine = labelledInput(h, 'Fine hue · degrees');
  const initial = hex(h);
  await h.act(() => fine.focus());
  await h.type(fine, '218');
  await h.act(async () => {
    finish(
      JSON.stringify({
        format: 'hwb-ant-design-controller',
        schemaVersion: 4,
        settings: { anchor: 90, offset: 0, w: 10, b: 18, mode: 'light' },
      }),
    );
    await pending;
  });
  assert.equal(hex(h), initial);
  assert.equal(Number(fine.value), 218);
  await h.act(() =>
    fine.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  assert.equal(labelledInput(h, 'Main hue · degrees').value, '214');
  assert.notEqual(hex(h), initial);
});

test('Color sliders consume the shared Radio-sized master without a competing geometry adapter', async () => {
  const entry = await readFile(
    new URL('../src/react/color/ColorSystemDemo.tsx', import.meta.url),
    'utf8',
  );
  assert.match(entry, /import AtlasSlider from '..\/AtlasSlider'/);
  assert.equal((entry.match(/<AtlasSlider/g) ?? []).length, 3);
  const family = await readFile(
    new URL('../src/react/color/ColorFamilyPreview.tsx', import.meta.url),
    'utf8',
  );
  assert.match(family, /import AtlasSlider from '..\/AtlasSlider'/);
  assert.equal((family.match(/<AtlasSlider/g) ?? []).length, 1);
  const ownStyles = await readFile(
    new URL('../src/styles/color-system.css', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(ownStyles, /--color-slider/);
  postcss.parse(ownStyles).walkRules(rule => {
    if (!rule.selector.includes('.ant-slider')) return;
    rule.walkDecls(decl => {
      assert.equal(
        decl.prop,
        'background-color',
        'Color owns live thumb paint, not native geometry',
      );
      assert.equal(decl.value, 'var(--slider-thumb-color)');
    });
  });
  const master = await readFile(new URL('../src/styles/slider.css', import.meta.url), 'utf8');
  assert.match(master, /--slider-visible-thumb-size: var\(--radio-size,/);
  assert.match(master, /max\(var\(--target-min\), var\(--slider-visible-thumb-size\), 2\.75rem\)/);
  assert.match(master, /max\(var\(--target-min\), var\(--slider-visible-thumb-size\), 3rem\)/);
  for (const page of ['pages/color-system.astro', 'pages/components/[slug].astro'])
    assert.match(
      await readFile(new URL('../src/' + page, import.meta.url), 'utf8'),
      /slider\.css\?url/,
    );
});
