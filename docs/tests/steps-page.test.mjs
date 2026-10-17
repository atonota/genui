import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';

const mountSteps = () =>
  mountPattern('default', 'docs/src/react/StepsDemo.tsx', { documentation: true });

test('Steps presents four linked sections with a closed Tweaker and readable native layout examples', async t => {
  const h = await mountSteps();
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-steps-catalog]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    ['steps-setup', 'steps-layouts', 'steps-recovery', 'steps-navigation'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.equal(
    h.document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  const examples = [...catalog.querySelectorAll('[data-steps-example]')];
  assert.deepEqual(
    examples.map(example => example.dataset.stepsExample),
    ['numbered', 'icons', 'centered', 'vertical'],
  );
  for (const example of examples) {
    assert.equal(example.querySelectorAll('.ant-steps-item').length, 3);
    assert.equal(example.querySelectorAll('[aria-current="step"]').length, 1);
    assert.equal(example.querySelectorAll('[role="button"]').length, 0);
  }
  assert.equal(examples[1].querySelectorAll('[data-icon-library="phosphor"]').length, 3);
  assert.equal(examples[3].querySelector('.genux-steps').dataset.stepsOrientation, 'vertical');
});

test('guided setup validates a name, retains the draft on Back and completes only through explicit actions', async t => {
  const h = await mountSteps();
  t.after(() => h.dispose());
  const primary = h.document.querySelector('[data-steps-primary]');
  const form = primary.querySelector('form');
  const name = primary.querySelector('[data-steps-workspace-name]');
  assert.equal(buttonByText(primary, 'Back').disabled, true);
  await h.type(name, ' ');
  await h.submit(form);
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.match(primary.querySelector('[role="alert"]').textContent, /at least 2 characters/);
  assert.equal(h.document.activeElement, name);
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'details');
  await h.type(name, 'Design studio');
  assert.equal(name.hasAttribute('aria-invalid'), false);
  await h.submit(form);
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'review');
  assert.equal(primary.querySelector('[data-steps-name-summary]').textContent, 'Design studio');
  await h.click(buttonByText(primary, 'Back'));
  assert.equal(h.document.activeElement, name);
  assert.equal(primary.querySelector('[data-steps-workspace-name]'), name);
  assert.equal(name.value, 'Design studio');
  await h.submit(form);
  await h.submit(form);
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'finish');
  assert.equal(primary.querySelector('.ant-steps-item-process') !== null, true);
  assert.match(primary.querySelector('[data-steps-setup-status]').textContent, /Step 3 of 3/);
  await h.submit(form);
  assert.equal(primary.querySelectorAll('.ant-steps-item-finish').length, 3);
  assert.match(primary.querySelector('[role="status"]').textContent, /local setup is complete/);
  assert.match(primary.textContent, /Nothing was sent/);
  const reset = buttonByText(primary, 'Start again');
  assert.equal(h.document.activeElement, reset);
  await h.click(reset);
  assert.equal(primary.querySelector('[data-steps-workspace-name]'), name);
  assert.equal(name.value, '');
  assert.equal(h.document.activeElement, name);
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'details');
});

test('presentation and language changes keep the current step and mounted setup draft', async t => {
  const h = await mountSteps();
  t.after(() => h.dispose());
  const primary = h.document.querySelector('[data-steps-primary]');
  const name = primary.querySelector('[data-steps-workspace-name]');
  await h.type(name, 'Keep this workspace');
  await h.submit(primary.querySelector('form'));
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await selectOption(h, h.document.querySelector('[data-steps-orientation] input'), 'Vertical');
  await selectOption(h, h.document.querySelector('[data-steps-variant] input'), 'Outlined');
  await selectOption(
    h,
    h.document.querySelector('[data-steps-title-placement] input'),
    'Below the marker',
  );
  await h.click(h.document.querySelector('[data-steps-icons]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[0]);
  assert.equal(primary.querySelector('.genux-steps').dataset.stepsSize, 'sm');
  assert.equal(primary.querySelector('.genux-steps').dataset.stepsOrientation, 'vertical');
  assert.equal(primary.querySelectorAll('[data-icon-library="phosphor"]').length, 3);
  assert.equal(primary.querySelector('[data-steps-workspace-name]'), name);
  assert.equal(name.value, 'Keep this workspace');
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'review');
  await h.act(() => h.setLocale('tr'));
  assert.equal(name.value, 'Keep this workspace');
  assert.equal(primary.querySelector('[data-steps-workspace-name]'), name);
  assert.equal(primary.querySelector('[aria-current="step"]').dataset.stepKey, 'review');
  assert.match(primary.textContent, /Bilgileri inceleyin/);
  assert.match(primary.querySelector('[aria-current="step"]').textContent, /Mevcut adım/);
  assert.equal(buttonByText(primary, 'Geri') !== undefined, true);
});

test('recovery changes only on explicit Retry and Confirm without inventing asynchronous progress', async t => {
  const h = await mountSteps();
  t.after(() => h.dispose());
  const recovery = h.document.querySelector('[data-steps-recovery]');
  assert.equal(recovery.dataset.recoveryState, 'error');
  assert.equal(recovery.querySelectorAll('.ant-steps-item-error').length, 1);
  assert.equal(recovery.querySelectorAll('.ant-steps-item-wait').length, 1);
  assert.match(recovery.querySelector('[role="alert"]').textContent, /confirmation is missing/);
  await h.click(buttonByText(recovery, 'Retry review'));
  assert.equal(recovery.dataset.recoveryState, 'process');
  assert.equal(recovery.querySelectorAll('.ant-steps-item-error').length, 0);
  assert.equal(recovery.querySelectorAll('.ant-steps-item-process').length, 1);
  assert.match(recovery.querySelector('[role="status"]').textContent, /no background process/);
  await h.click(buttonByText(recovery, 'Confirm review'));
  assert.equal(recovery.dataset.recoveryState, 'finish');
  assert.equal(recovery.querySelectorAll('.ant-steps-item-finish').length, 2);
  assert.equal(recovery.querySelectorAll('.ant-steps-item-wait').length, 1);
  await h.click(buttonByText(recovery, 'Show the issue again'));
  assert.equal(recovery.dataset.recoveryState, 'error');
});

test('navigation reveals meaningful content and never enters its disabled step', async t => {
  const h = await mountSteps();
  t.after(() => h.dispose());
  const preview = h.document.querySelector('[data-steps-navigation-preview]');
  const content = preview.querySelector('[data-steps-navigation-content]');
  const [overview, activity, access] = preview.querySelectorAll('.ant-steps-item');
  assert.match(content.textContent, /Workspace overview/);
  assert.equal(access.getAttribute('aria-disabled'), 'true');
  await h.click(access);
  assert.equal(overview.getAttribute('aria-current'), 'step');
  assert.match(content.textContent, /Workspace overview/);
  await h.click(activity);
  assert.equal(activity.getAttribute('aria-current'), 'step');
  assert.match(content.textContent, /Recent activity/);
  assert.equal(preview.querySelector('[data-steps-navigation-content]'), content);
  await h.act(() => h.setLocale('tr'));
  assert.match(content.textContent, /Son etkinlikler/);
  assert.match(preview.textContent, /Erişim ayarları bu yerel örnekte kullanılamaz/);
});
