import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

const entry = 'docs/src/react/workspace/CollectionDemo.tsx';
const pillColor = pill => pill.getAttribute('data-pill-color');
function statusColors(document) {
  const colors = new Map();
  const pills = [...document.querySelectorAll('[data-collection-view] .atlas-pill')];
  for (const pill of pills) {
    const label = pill.textContent.trim();
    if (colors.has(label)) assert.equal(pillColor(pill), colors.get(label), label);
    colors.set(label, pillColor(pill));
  }
  return colors;
}
function totalColors(document) {
  return new Map(
    [...document.querySelectorAll('.atlas-pill')]
      .filter(pill => /^(USD|EUR):/.test(pill.textContent.trim()))
      .map(pill => [pill.textContent.trim().slice(0, 3), pillColor(pill)]),
  );
}

test('workspace status and currency labels have distinct shared-palette colors before and after filtering', async t => {
  const h = await mountPattern('DataTableDemo', entry, { documentation: true });
  t.after(() => h.dispose());
  const statuses = statusColors(h.document);
  assert.equal(statuses.size, 4);
  assert.equal(new Set(statuses.values()).size, 4, 'different statuses need different colors');
  assert.deepEqual(
    statuses,
    new Map([
      ['Pending approval', 'orange'],
      ['Approved', 'green'],
      ['Shipped', 'cyan-blue'],
      ['Draft', 'red'],
    ]),
    'status labels use clearly separated hue families, not adjacent warm shades',
  );
  const currencies = totalColors(h.document);
  assert.equal(currencies.size, 2);
  assert.deepEqual(
    currencies,
    new Map([
      ['USD', 'violet'],
      ['EUR', 'magenta-red'],
    ]),
  );
  assert.equal(new Set([...statuses.values(), ...currencies.values()]).size, 6);
  const search = h.document.querySelector('#collection-search');
  await h.type(search, 'Birch');
  assert.deepEqual([...statusColors(h.document)], [['Approved', statuses.get('Approved')]]);
  for (const [currency, color] of totalColors(h.document))
    assert.equal(color, currencies.get(currency), 'filtered totals keep their currency color');
  await h.type(search, '');
  assert.deepEqual(statusColors(h.document), statuses);
  const firstRow = h.document
    .querySelector('.ant-table-tbody tr[data-row-key]')
    .getAttribute('data-row-key');
  await h.click(h.document.querySelector('#collection-filters'));
  await h.click(h.document.querySelector('#collection-sort-direction-desc'));
  await h.click(h.document.querySelector('.ant-drawer-close'));
  assert.notEqual(
    h.document.querySelector('.ant-table-tbody tr[data-row-key]').getAttribute('data-row-key'),
    firstRow,
  );
  assert.deepEqual(
    statusColors(h.document),
    statuses,
    'sorting changes row order, not color identity',
  );
  assert.deepEqual(
    totalColors(h.document),
    currencies,
    'sorting changes total order, not color identity',
  );
  const pending = [...h.document.querySelectorAll('.collection-col-status .atlas-pill')].find(
    pill => pill.textContent.trim() === 'Pending approval',
  );
  await h.click(h.document.querySelector('#collection-open-SP-26-0401'));
  const detail = h.document.querySelector('[data-record-summary] .atlas-pill');
  assert.equal(
    pillColor(detail),
    pillColor(pending),
    'table and detail share the same status color',
  );
  for (const mode of ['dark', 'light']) {
    await h.act(() => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
    });
    assert.deepEqual(statusColors(h.document), statuses);
  }
  await h.act(() => h.setLocale('tr'));
  assert.equal(pending.textContent.trim(), 'Onay bekliyor');
  assert.equal(pillColor(pending), statuses.get('Pending approval'));
  assert.equal(pillColor(detail), statuses.get('Pending approval'));
  assert.deepEqual(totalColors(h.document), currencies);
});

test('mobile record labels use the same distinct status mapping', async t => {
  const h = await mountPattern('default', entry, { documentation: true, initialProfile: 'mobile' });
  t.after(() => h.dispose());
  const statuses = statusColors(h.document);
  assert.equal(statuses.size, 4);
  assert.equal(new Set(statuses.values()).size, 4);
  await h.type(h.document.querySelector('#collection-search'), 'Aster');
  assert.deepEqual(
    [...statusColors(h.document)],
    [['Pending approval', statuses.get('Pending approval')]],
  );
});
