import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

const assertUniqueIds = document => {
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  assert.equal(new Set(ids).size, ids.length, 'panes do not duplicate interactive content');
};

for (const [name, exported, props] of [
  ['Data table', 'DataTableDemo', {}],
  ['Collection views', 'default', {}],
  ['Mobile collection views', 'default', { initialProfile: 'mobile' }],
]) {
  test(`${name} keeps the collection mounted while opening and closing its splitter inspector`, async t => {
    const h = await mountPattern(exported, 'docs/src/react/workspace/CollectionDemo.tsx', props);
    t.after(() => h.dispose());
    const splitter = h.document.querySelector('#collection-workspace-splitter');
    assert.ok(splitter, 'the default flow exposes the shared splitter');
    const main = h.document.querySelector('[data-collection-view]');
    const search = h.document.querySelector('#collection-search');
    await h.type(search, 'SP-26-0401');
    await h.click(h.document.querySelector('#collection-select-visible'));
    const opener = h.document.querySelector('#collection-open-SP-26-0401');
    await h.click(opener);
    assert.equal(h.document.querySelector('[data-collection-view]'), main);
    assert.ok(splitter.querySelector('.collection-detail'));
    assert.match(h.document.querySelector('#collection-results').textContent, /1 selected records/);
    await h.click(h.document.querySelector('#collection-detail-back'));
    assert.equal(h.document.querySelector('[data-collection-view]'), main);
    assert.equal(h.document.activeElement, opener, 'closing inspection returns focus');
    assert.equal(search.value, 'SP-26-0401');
    assertUniqueIds(h.document);
  });
}

test('Record details starts with one split browser and retains the active draft on layout changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordDetailsDemo.tsx');
  t.after(() => h.dispose());
  const splitter = h.document.querySelector('#record-details-splitter');
  assert.ok(splitter, 'split inspection is reachable without configuring Tweaker');
  const browser = splitter.querySelector('.workspace-details-results');
  await h.click(h.document.querySelector('[data-record-open="SP-26-0401"]'));
  await h.click(h.document.querySelector('#details-edit'));
  const customer = h.document.querySelector('#details-customer');
  await h.type(customer, 'Splitter draft customer');
  await h.click(h.document.querySelector('#details-mobile'));
  await h.click(h.document.querySelector('#details-desktop'));
  assert.equal(h.document.querySelector('.workspace-details-results'), browser);
  assert.equal(h.document.querySelector('#details-customer'), customer);
  assert.equal(customer.value, 'Splitter draft customer');
  assertUniqueIds(h.document);
});

test('Record forms shares its live draft with the review pane without duplicating editable fields', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/RecordFormsDemo.tsx');
  t.after(() => h.dispose());
  const splitter = h.document.querySelector('#record-form-splitter');
  assert.ok(splitter);
  const customer = h.document.querySelector('#record-form-customer');
  await h.type(customer, 'Live draft customer');
  assert.match(splitter.querySelector('[data-form-review]').textContent, /Live draft customer/);
  assert.ok(splitter.querySelector('#record-form-submit'), 'submission remains with the editor');
  await h.click(h.document.querySelector('#forms-mobile'));
  await h.click(h.document.querySelector('#forms-desktop'));
  assert.equal(h.document.querySelector('#record-form-customer'), customer);
  assert.equal(customer.value, 'Live draft customer');
  assertUniqueIds(h.document);
});

test('Connected workspace shares splitter sizing while keeping record inspection independent from checked targets', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/kit/ConnectedWorkspace.tsx');
  t.after(() => h.dispose());
  const splitter = h.document.querySelector('#connected-orders-splitter');
  assert.ok(splitter);
  assert.ok(splitter.querySelector('.kit-collection'));
  assert.ok(splitter.querySelector('.kit-connected-detail'));
  assert.equal(
    splitter.querySelector('.kit-inspector-resize'),
    null,
    'the shared splitter owns resizing',
  );
  const collection = splitter.querySelector('.kit-collection');
  const inspector = splitter.querySelector('.kit-connected-detail');
  const checkbox = collection.querySelector('.kit-record-check input');
  await h.click(checkbox);
  assert.equal(checkbox.checked, true);
  const activeTab = inspector.querySelector('[role="tab"][aria-selected="true"]');
  const activeId = activeTab.dataset.recordTab;
  const anotherTab = [...inspector.querySelectorAll('[role="tab"]')].find(
    tab => tab.dataset.recordTab !== activeId,
  );
  await h.click(anotherTab);
  assert.equal(checkbox.checked, true, 'inspecting another record does not change checked targets');
  const activeAfterInspection = anotherTab.dataset.recordTab;
  await h.click(h.document.querySelector('#connected-kit-mobile'));
  await h.click(h.document.querySelector('#connected-kit-desktop'));
  assert.equal(splitter.querySelector('.kit-collection'), collection);
  assert.equal(splitter.querySelector('.kit-connected-detail'), inspector);
  assert.equal(checkbox.checked, true);
  assert.equal(
    inspector.querySelector('[role="tab"][aria-selected="true"]').dataset.recordTab,
    activeAfterInspection,
  );
  assertUniqueIds(h.document);
});
