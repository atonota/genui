import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern, selectOption } from './harness.mjs';

const mountAutoComplete = () =>
  mountPattern('default', 'docs/src/react/AutoCompleteDemo.tsx', { documentation: true });

function field(scope, label) {
  const match = [...scope.querySelectorAll('label')].find(node => node.textContent === label);
  assert.ok(match, `Field label ${label}`);
  return scope.querySelector(`input[id="${match.htmlFor}"]`);
}

async function choose(h, input, query, title) {
  await h.type(input, query);
  await h.waitFor(
    () =>
      [...h.document.querySelectorAll('.ant-select-item-option')].some(item =>
        item.textContent.includes(title),
      ),
    `Suggestion ${title}`,
  );
  const option = [...h.document.querySelectorAll('.ant-select-item-option')].find(item =>
    item.textContent.includes(title),
  );
  await h.click(option);
}

test('AutoComplete organizes four linked journeys and shows grouped useful local results', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-autocomplete-catalog]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    [
      'autocomplete-discover',
      'autocomplete-patterns',
      'autocomplete-recovery',
      'autocomplete-availability',
    ],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.equal(
    h.document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  const input = field(catalog, 'Find in the documentation');
  await h.type(input, 'button');
  await h.waitFor(
    () => h.document.querySelector('.ant-select-item-group'),
    'Grouped local suggestion',
  );
  assert.match(h.document.querySelector('.ant-select-item-group').textContent, /Components/);
  const option = h.document.querySelector('.ant-select-item-option');
  assert.match(option.textContent, /Choose a clear action and the right emphasis/);
  assert.match(option.textContent, /Actions/);
  assert.match(catalog.textContent, /six local documentation entries/);
  assert.equal(catalog.querySelectorAll('select').length, 0);
});

test('a chosen result previews real routes, while a typed edit removes stale selected context', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const primary = h.document.querySelector('[data-autocomplete-primary]');
  const input = field(primary, 'Find in the documentation');
  const context = primary.querySelector('[data-autocomplete-context]');
  assert.equal(context.dataset.selectedKey, '');
  await choose(h, input, 'button', 'Button');
  assert.equal(input.value, 'Button');
  assert.equal(context.dataset.selectedKey, 'button');
  assert.deepEqual(
    [...context.querySelectorAll('a')].map(link => link.pathname),
    ['/components/button/', '/components/dropdown/'],
  );
  assert.match(context.textContent, /Choose a clear action/);
  await h.type(input, 'My own wording');
  assert.equal(input.value, 'My own wording');
  assert.equal(context.dataset.selectedKey, '');
  assert.equal(context.querySelector('a'), null);
  assert.match(context.textContent, /A little context, a clearer choice/);
  await choose(h, input, 'button', 'Button');
  await h.click(input.closest('.ant-select').querySelector('.ant-select-clear'));
  assert.equal(input.value, '');
  assert.equal(context.dataset.selectedKey, '');
  assert.equal(context.querySelector('a'), null);
});

test('team and email suggestions preserve free text and never complete an address until selected', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const team = field(h.document, 'Find or enter a team');
  await h.type(team, 'A team outside the list');
  assert.equal(team.value, 'A team outside the list');
  await h.waitFor(
    () => h.document.querySelector('.ant-select-item-empty'),
    'A truthful no-match state',
  );
  assert.match(
    h.document.querySelector('.ant-select-item-empty').textContent,
    /No suggestions match/,
  );
  assert.equal(team.getAttribute('aria-invalid'), null);
  const email = field(h.document, 'Contact email');
  await h.type(email, 'alex');
  await h.waitFor(
    () =>
      [...h.document.querySelectorAll('.ant-select-item-option')].some(item =>
        item.textContent.includes('alex@example.com'),
      ),
    'Explicit email completion',
  );
  assert.equal(email.value, 'alex');
  await choose(h, email, 'alex', 'alex@example.com');
  assert.equal(email.value, 'alex@example.com');
  await h.type(email, 'alex@custom.test');
  assert.equal(email.value, 'alex@custom.test');
});

test('availability samples keep the draft through error, explicit Retry and a held loading state', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const recovery = h.document.querySelector('[data-autocomplete-recovery]');
  const input = field(recovery, 'Documentation suggestions');
  await h.type(input, 'workspace');
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await selectOption(
    h,
    h.document.querySelector('[data-autocomplete-availability] input'),
    'Error sample',
  );
  assert.equal(recovery.dataset.availability, 'error');
  assert.equal(field(recovery, 'Documentation suggestions'), input);
  assert.equal(input.value, 'workspace');
  const retry = [...recovery.querySelectorAll('button')].find(button =>
    /Retry/.test(button.textContent),
  );
  assert.ok(retry, 'An explicit local Retry action');
  await h.click(retry);
  assert.equal(recovery.dataset.availability, 'ready');
  assert.equal(input.value, 'workspace');
  await selectOption(
    h,
    h.document.querySelector('[data-autocomplete-availability] input'),
    'Loading sample',
  );
  assert.equal(recovery.dataset.availability, 'loading');
  assert.match(
    recovery.querySelector('[data-autocomplete-sample-note]').textContent,
    /No request or timer/,
  );
  assert.equal(input.disabled, false);
  await h.type(input, 'Keep this while waiting');
  assert.equal(input.value, 'Keep this while waiting');
});

test('field issues are linked, correction removes an error and a disabled value stays explained', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const error = h.document.querySelector('[data-autocomplete-example="error"]');
  const input = field(error, 'Email to correct');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  const alert = error.querySelector('[role="alert"]');
  assert.match(alert.textContent, /Enter a complete address/);
  assert.ok(input.getAttribute('aria-describedby').split(' ').includes(alert.id));
  await h.type(input, 'team@example.com');
  assert.notEqual(input.getAttribute('aria-invalid'), 'true');
  assert.equal(error.querySelector('[role="alert"]'), null);
  const disabled = h.document.querySelector('[data-autocomplete-example="disabled"]');
  const disabledInput = field(disabled, 'Assigned team');
  assert.equal(disabledInput.disabled, true);
  assert.equal(disabledInput.value, 'GenUX Studio');
  assert.match(disabled.textContent, /Team assignment is unavailable/);
  const warning = field(h.document, 'Team to review');
  await h.type(warning, 'A custom team');
  assert.equal(warning.value, 'A custom team');
  assert.equal(warning.disabled, false);
});

test('size, suggestion detail, theme and locale preserve mounted fields, selected context and other drafts', async t => {
  const h = await mountAutoComplete();
  t.after(() => h.dispose());
  const primary = h.document.querySelector('[data-autocomplete-primary]');
  const search = field(primary, 'Find in the documentation');
  const team = field(h.document, 'Find or enter a team');
  await h.type(team, 'Keep this team');
  await choose(h, search, 'pill', 'Pill');
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await selectOption(h, h.document.querySelector('[data-autocomplete-detail] input'), 'Compact');
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[0]);
  assert.equal(field(primary, 'Find in the documentation'), search);
  assert.equal(search.value, 'Pill');
  assert.equal(team.value, 'Keep this team');
  assert.equal(primary.querySelector('[data-autocomplete-context]').dataset.selectedKey, 'pill');
  await h.act(async () => {
    h.document.documentElement.dataset.theme = 'dark';
    h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
  });
  assert.equal(h.document.querySelector('.genux-demo').dataset.themeMode, 'dark');
  assert.equal(field(primary, 'Find in the documentation'), search);
  assert.equal(search.value, 'Pill');
  assert.equal(team.value, 'Keep this team');
  await h.act(() => h.setLocale('tr'));
  assert.equal(field(primary, 'Dokümantasyonda bulun'), search);
  assert.equal(search.value, 'Pill');
  assert.equal(field(h.document, 'Ekip bulun veya girin'), team);
  assert.equal(team.value, 'Keep this team');
  assert.match(
    primary.querySelector('[data-autocomplete-context]').textContent,
    /Okunabilir etiketlerle/,
  );
  assert.match(
    h.document.querySelector('[data-autocomplete-catalog]').textContent,
    /Yararlı tamamlamalar/,
  );
});
