import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buttonByText, mountPattern, selectOption } from './harness.mjs';

test('Card begins with Entity and Metric foundations, one playground and five linked sections', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-card-preview]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    ['card-foundations', 'card-catalog', 'card-interactions', 'card-states', 'card-genux'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.ok(sections[0].querySelector('[data-card-kind="entity"]'));
  assert.ok(sections[0].querySelector('[data-card-kind="metric"]'));
  assert.equal(catalog.querySelectorAll('[data-card-main]').length, 1);
  assert.equal(
    catalog.querySelectorAll('.ant-card-type-inner, .ant-card-grid').length,
    0,
    'peer cards are siblings, never visual cards inside a card',
  );
  assert.equal(h.document.querySelectorAll('[data-tweaker-trigger]').length, 1);
  assert.equal(
    h.document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
});

test('the purpose catalog exposes 23 purposes and 31 domain recipes with one selected preview', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('#card-catalog');
  assert.equal(catalog.dataset.purposeCount, '23');
  assert.ok(Number(catalog.dataset.recipeCount) >= 31);
  assert.equal(catalog.querySelectorAll('[data-recipe-preview] [data-genux-card]').length, 1);
  await selectOption(h, catalog.querySelector('input[aria-label="Recipe category"]'), 'Commerce');
  assert.equal(catalog.querySelectorAll('[data-recipe-preview] [data-genux-card]').length, 1);
  const selectedTitle = catalog.querySelector(
    '[data-recipe-preview] [data-genux-card] h4',
  ).textContent;
  await h.click(catalog.querySelector('[data-card-primary]'));
  await h.waitFor(() => h.document.querySelector('[role="dialog"]'), 'real local details');
  const dialog = h.document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, new RegExp(selectedTitle));
  assert.ok(dialog.querySelector('[data-card-details-id]'));
});

test('selection, task moves and form drafts are controlled local outcomes preserved by presentation changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const interactions = h.document.querySelector('#card-interactions');
  const choice = interactions.querySelector('[data-card-kind="selection"] input');
  await h.click(choice);
  assert.match(interactions.querySelector('[data-selection-result]').textContent, /1 selected/);
  const form = interactions.querySelector('[data-card-kind="form"] input');
  await h.type(form, 'A preserved review');
  await h.click(buttonByText(interactions, 'Save draft locally'));
  assert.match(interactions.querySelector('[data-form-result]').textContent, /A preserved review/);
  await h.click(buttonByText(interactions, 'Move to In progress'));
  assert.equal(
    interactions.querySelector('[data-card-kind="task"]').closest('[data-task-lane]').dataset
      .taskLane,
    'active',
  );
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[0]);
  assert.equal(h.document.querySelector('[data-card-preview]').dataset.cardProfile, 'sm');
  assert.equal(interactions.querySelector('[data-card-kind="form"] input'), form);
  assert.equal(form.value, 'A preserved review');
  await h.act(() => h.setLocale('tr'));
  assert.equal(form.value, 'A preserved review');
  assert.equal(choice.checked, true);
});

test('GenUX is opt-in, and the initial Card module has no X Cards or SDK import', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('[data-genux-card-lab]'), null);
  const trigger = buttonByText(h.document.querySelector('#card-genux'), 'Open GenUX lab');
  assert.ok(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  const source = await readFile(new URL('../src/react/CardDemo.tsx', import.meta.url), 'utf8');
  assert.match(source, /lazy\(\(\) => import\('\.\/genux\/GenUXCardLab'\)\)/);
  assert.doesNotMatch(source, /from ['"]@ant-design\/x-(?:card|sdk)/);
});

test('task Pointer Events commit only an owned lane and cancellation does not move the task', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const area = h.document.querySelector('#card-interactions');
  let captured = null;
  h.window.HTMLElement.prototype.setPointerCapture = function (id) {
    captured = id;
  };
  h.window.HTMLElement.prototype.hasPointerCapture = function (id) {
    return captured === id;
  };
  h.window.HTMLElement.prototype.releasePointerCapture = function () {
    captured = null;
  };
  const dispatch = async (type, id = 1) => {
    const handle = area.querySelector('[aria-label="Drag review task"]');
    const event = new h.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 20,
      clientY: 20,
    });
    Object.defineProperty(event, 'pointerId', { value: id });
    await h.act(() => handle.dispatchEvent(event));
  };
  const lane = () =>
    area.querySelector('[data-card-kind="task"]').closest('[data-task-lane]').dataset.taskLane;
  h.document.elementFromPoint = () => area.querySelector('[data-task-lane="done"]');
  await dispatch('pointerdown');
  assert.equal(area.querySelector('.card-task-board').dataset.dragging, 'true');
  await dispatch('pointercancel');
  await dispatch('pointerup');
  assert.equal(lane(), 'planned');
  await dispatch('pointerdown', 2);
  await dispatch('lostpointercapture', 2);
  await dispatch('pointerup', 2);
  assert.equal(lane(), 'planned');
  await dispatch('pointerdown', 3);
  await dispatch('pointerdown', 4);
  assert.equal(captured, 3, 'a second pointer cannot replace the captured owner');
  await dispatch('pointercancel', 4);
  await dispatch('lostpointercapture', 4);
  assert.equal(area.querySelector('.card-task-board').dataset.dragging, 'true');
  await dispatch('pointerup', 4);
  assert.equal(lane(), 'planned');
  await dispatch('pointerup', 3);
  assert.equal(lane(), 'done');
  assert.equal(area.querySelector('.card-task-board').dataset.dragging, 'false');
});

test('empty form drafts expose validation and do not claim a local save', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const area = h.document.querySelector('#card-interactions');
  await h.type(area.querySelector('[data-card-kind="form"] input'), '   ');
  await h.click(buttonByText(area, 'Save draft locally'));
  assert.match(area.querySelector('[role="alert"]').textContent, /Enter a review title/);
  const input = area.querySelector('[data-card-kind="form"] input');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(
    h.document.getElementById(input.getAttribute('aria-describedby')),
    area.querySelector('[role="alert"]'),
  );
  assert.doesNotMatch(area.querySelector('[data-form-result]').textContent, /Saved draft/);
});

test('keyboard focus follows a task into its new lane', async t => {
  const h = await mountPattern('default', 'docs/src/react/CardDemo.tsx', { documentation: true });
  t.after(() => h.dispose());
  const area = h.document.querySelector('#card-interactions');
  const move = buttonByText(area, 'Move to In progress');
  move.focus();
  await h.click(move);
  assert.equal(h.document.activeElement, area.querySelector('[aria-label="Drag review task"]'));
  assert.equal(h.document.activeElement.closest('[data-task-lane]').dataset.taskLane, 'active');
});
