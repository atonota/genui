import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { mountPattern, selectOption } from './harness.mjs';

const mount = () =>
  mountPattern('default', 'docs/src/react/CascaderDemo.tsx', { documentation: true });
const items = scope => [...scope.querySelectorAll('[role="treeitem"]')];
const item = (scope, title) => items(scope).find(node => node.title === title);
const labelled = (scope, label) =>
  [...scope.querySelectorAll('label')].find(node => node.textContent === label);
function field(scope, label) {
  const node = labelled(scope, label);
  assert.ok(node, label);
  return scope.querySelector(`input[id="${node.htmlFor}"]`);
}

// Native Select opens on root mousedown, and Cascader items commit on click after
// a prevented mousedown. Emit the browser's complete primary-pointer sequence.
async function press(h, element) {
  if (!element) throw new Error('Press target missing');
  const Pointer = h.window.PointerEvent ?? h.window.MouseEvent;
  const init = { bubbles: true, cancelable: true, button: 0, buttons: 1 };
  const pointer = { ...init, pointerType: 'mouse', isPrimary: true };
  await h.act(async () => {
    element.dispatchEvent(new Pointer('pointerdown', pointer));
    const down = new h.window.MouseEvent('mousedown', init);
    element.dispatchEvent(down);
    if (!down.defaultPrevented) element.closest('input, button, [tabindex]')?.focus();
    element.dispatchEvent(new Pointer('pointerup', { ...pointer, buttons: 0 }));
    element.dispatchEvent(new h.window.MouseEvent('mouseup', { ...init, buttons: 0 }));
    element.click();
    await delay(5);
  });
}

async function popup(h, input) {
  await h.waitFor(
    () =>
      input.getAttribute('aria-expanded') === 'true' &&
      h.document.getElementById(input.getAttribute('aria-controls') ?? ''),
    'combobox controls its open popup',
  );
  return h.document.getElementById(input.getAttribute('aria-controls'));
}

async function choose(h, input, query, title) {
  await h.type(input, query);
  const option = item(await popup(h, input), title);
  assert.ok(option, title);
  assert.equal(option.getAttribute('aria-disabled'), 'false');
  await press(h, option);
}

test('five anchored journeys keep settings closed and confirm a contextual path', async t => {
  const h = await mount();
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-cascader-catalog]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    [
      'cascader-search',
      'cascader-multiple',
      'cascader-display',
      'cascader-states',
      'cascader-lazy',
    ],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  for (const section of sections)
    assert.ok(
      h.document.getElementById(section.getAttribute('aria-labelledby'))?.textContent,
      `${section.id} has a visible heading`,
    );
  assert.equal(
    h.document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  const destination = field(catalog, 'Workspace destination');
  await choose(h, destination, 'engineering review', 'Studio / Engineering / Review');
  const selection = catalog.querySelector('[data-cascader-selection]');
  assert.equal(selection.dataset.cascaderSelection, 'studio/engineering/review');
  assert.match(selection.textContent, /Studio \/ Engineering \/ Review/);
});

test('locale changes preserve mounted choices and translated full-path search', async t => {
  const h = await mount();
  t.after(() => h.dispose());
  const input = field(h.document, 'Workspace destination');
  await choose(h, input, 'engineering review', 'Studio / Engineering / Review');
  await h.act(async () => {
    await h.setLocale('tr');
  });
  await h.waitFor(() => labelled(h.document, 'Çalışma alanı hedefi'), 'Turkish field label');
  assert.equal(field(h.document, 'Çalışma alanı hedefi'), input, 'the same field stays mounted');
  const selection = h.document.querySelector('[data-cascader-selection]');
  assert.equal(selection.dataset.cascaderSelection, 'studio/engineering/review');
  assert.match(selection.textContent, /Stüdyo \/ Mühendislik \/ İnceleme/);
  await h.type(input, 'tasarim inceleme');
  assert.deepEqual(
    items(await popup(h, input)).map(node => node.title),
    ['Stüdyo / Tasarım / İnceleme'],
  );
  assert.equal(selection.dataset.cascaderSelection, 'studio/engineering/review');
});

test('presentation changes preserve controlled selections and keep the full path visible', async t => {
  const h = await mount();
  t.after(() => h.dispose());
  const compact = field(h.document, 'Selected path');
  const assigned = field(h.document, 'Assigned areas');
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await selectOption(h, h.document.querySelector('[data-cascader-display]'), 'Final item');
  assert.equal(field(h.document, 'Selected path'), compact);
  const control = compact.closest('.ant-select').querySelector('.ant-select-content');
  assert.match(control.textContent, /Review/);
  assert.equal(control.textContent.includes('Studio /'), false);
  assert.match(
    h.document.querySelector('[data-cascader-full-path]').textContent,
    /Studio \/ Engineering \/ Review/,
  );
  await selectOption(
    h,
    h.document.querySelector('[data-cascader-strategy]'),
    'Show individual leaves',
  );
  assert.equal(field(h.document, 'Assigned areas'), assigned);
  assert.equal(
    h.document.querySelector('[data-cascader-assignments]').dataset.cascaderAssignments,
    '[["studio","design","library"]]',
  );
});

test('linked error resolves on selection and the locked field retains its path', async t => {
  const h = await mount();
  t.after(() => h.dispose());
  const required = field(h.document, 'Required destination');
  assert.equal(required.getAttribute('aria-invalid'), 'true');
  const described = (required.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map(id => h.document.getElementById(id));
  assert.ok(described.every(Boolean), 'every description exists');
  assert.ok(
    described.some(node => /Choose a team or area before continuing/.test(node.textContent)),
  );
  assert.ok(described.some(node => /clears the error after a choice/.test(node.textContent)));
  await choose(h, required, 'engineering review', 'Studio / Engineering / Review');
  assert.equal(required.hasAttribute('aria-invalid'), false);
  assert.doesNotMatch(
    required.closest('[data-cascader-field]').textContent,
    /Choose a team or area before continuing/,
  );
  const locked = field(h.document, 'Locked destination');
  assert.equal(locked.disabled, true);
  const lockedField = locked.closest('[data-cascader-field]');
  assert.match(lockedField.textContent, /Studio \/ Design \/ Component library/);
  assert.equal(lockedField.querySelector('button[aria-label="Clear value"]'), null);
});

test('local lazy reveal stays browse-only and commits a revealed record group', async t => {
  const h = await mount();
  t.after(() => h.dispose());
  const lazy = field(h.document, 'Browse a collection');
  const section = lazy.closest('#cascader-lazy');
  assert.equal(lazy.readOnly, true, 'lazy mode has no search draft');
  assert.match(section.textContent, /Children have not been revealed yet/);
  await press(h, lazy);
  const tree = await popup(h, lazy);
  await press(h, item(tree, 'Collection'));
  assert.equal(section.querySelector('[data-cascader-lazy-value]').dataset.cascaderLazyValue, '');
  await h.waitFor(() => item(tree, 'Collection / Records'), 'local children are revealed');
  assert.match(section.textContent, /Local children are available/);
  await press(h, item(tree, 'Collection / Records'));
  await press(h, item(tree, 'Collection / Records / Active records'));
  assert.equal(
    section.querySelector('[data-cascader-lazy-value]').dataset.cascaderLazyValue,
    'collection/records/active',
  );
  assert.match(section.textContent, /Collection \/ Records \/ Active records/);
});
