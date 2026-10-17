import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { buttonByText, mountPattern } from './harness.mjs';

async function adapter() {
  const output = await build({
    entryPoints: ['docs/src/data/card-field-adapter.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    packages: 'external',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].contents).toString('base64')
  );
}

test('serializable descriptors compile into bounded trusted getters and preserve zero, currency and unavailable access', async () => {
  const { compileFieldDescriptors, entityCardFromFields } = await adapter();
  const fields = compileFieldDescriptors([
    { key: 'amount', label: 'Amount', kind: 'money', currency: 'EUR', precision: 2 },
    {
      key: 'secret',
      label: 'Secret',
      kind: 'text',
      availability: { state: 'restricted', reason: 'Private field' },
    },
  ]);
  let reads = 0;
  const record = {
    id: 'ORDER-1',
    amount: 0,
    get secret() {
      reads++;
      throw new Error('restricted getter');
    },
  };
  const card = entityCardFromFields(record, fields, { locale: 'en' });
  assert.equal(reads, 0);
  assert.match(card.facts[0].value, /€0\.00/);
  assert.match(card.facts[1].value, /Restricted.*Private field/);
  assert.equal(fields[1].getValue(record), null);
  assert.equal(reads, 0);
  const changed = fields[0].setValue(record, 12);
  assert.equal(changed.amount, 12);
  assert.equal(reads, 0, 'editing another field does not evaluate protected accessors');
  const frozen = Object.freeze({ id: 'FROZEN', amount: 0 });
  const updatedFrozen = fields[0].setValue(frozen, 24);
  assert.equal(updatedFrozen.amount, 24);
  assert.equal(frozen.amount, 0, 'a field update never mutates a frozen source record');
  assert.throws(
    () =>
      compileFieldDescriptors([{ key: 'x', label: 'X', kind: 'text', getValue: () => 'unsafe' }]),
    /serializable/,
  );
  let metadataReads = 0;
  assert.throws(
    () =>
      compileFieldDescriptors([
        {
          get key() {
            metadataReads++;
            return 'x';
          },
          label: 'X',
          kind: 'text',
        },
      ]),
    /accessor/,
  );
  assert.equal(metadataReads, 0);
  assert.throws(() => compileFieldDescriptors(new Array(1)), /descriptor/);
  assert.throws(
    () => compileFieldDescriptors([{ key: '__proto__', label: 'Unsafe', kind: 'text' }]),
    /key/i,
  );
  assert.throws(
    () =>
      compileFieldDescriptors([
        { key: 'x', label: 'X', kind: 'text' },
        { key: 'x', label: 'X', kind: 'text' },
      ]),
    /duplicate/i,
  );
  assert.throws(
    () => compileFieldDescriptors([{ key: 'x', label: 'X', kind: 'javascript' }]),
    /kind/i,
  );
});

test('Frappe metadata uses a bounded explicit bridge, rejects dynamic money and never invents server permissions', async () => {
  const { adaptFrappeDocType, compileFieldDescriptors, FRAPPE_CARD_FIXTURE } = await adapter();
  const result = adaptFrappeDocType(FRAPPE_CARD_FIXTURE);
  assert.equal(result.doctype, 'Sales review');
  assert.ok(result.fields.some(field => field.kind === 'money' && field.currency === 'EUR'));
  assert.ok(result.fields.some(field => field.kind === 'choice' && field.options.length === 3));
  assert.equal(compileFieldDescriptors(result.fields).length, result.fields.length);
  const bounded = adaptFrappeDocType({
    name: 'Orders',
    fields: [
      { fieldname: 'total', label: 'Total', fieldtype: 'Currency', options: 'currency' },
      { fieldname: 'children', label: 'Children', fieldtype: 'Table' },
    ],
  });
  assert.equal(bounded.fields.length, 0);
  assert.equal(bounded.unsupported.length, 2);
});

const record = { id: 'ORDER-0', amount: 0 };
const props = (overrides = {}) => ({
  records: [record],
  fields: [
    { key: 'amount', label: 'Amount', kind: 'number', getValue: r => r.amount },
    {
      key: 'secret',
      label: 'Secret',
      kind: 'text',
      getValue: () => {
        throw new Error('restricted getter');
      },
      availability: () => ({ state: 'restricted', reason: 'Private field' }),
    },
  ],
  query: { search: '', filters: [], sort: [] },
  onQueryChange: () => {},
  activeId: null,
  onActiveIdChange: () => {},
  checkedIds: [],
  onCheckedIdsChange: () => {},
  projection: ['amount', 'secret'],
  onProjectionChange: () => {},
  cards: true,
  ...overrides,
});

test('workspace Cards reuse EntityCard with guarded fields and host-owned open and selection callbacks', async t => {
  const opened = [],
    checked = [];
  const h = await mountPattern(
    'ListView',
    'docs/src/react/workspace/kit/ViewAdapters.tsx',
    props({
      onActiveIdChange: id => opened.push(id),
      onCheckedIdsChange: ids => checked.push(ids),
    }),
  );
  t.after(() => h.dispose());
  const card = h.document.querySelector('[data-card-kind="entity"]');
  assert.ok(card);
  assert.match(card.textContent, /Amount.*0/);
  assert.match(card.textContent, /Restricted.*Private field/);
  await h.click(buttonByText(card, 'Open ORDER-0'));
  assert.deepEqual(opened, ['ORDER-0']);
  await h.click(card.querySelector('input[type="checkbox"]'));
  assert.deepEqual(checked, [['ORDER-0']]);
});

test('ordinary workspace lists retain their field view and stable record identity', async t => {
  const h = await mountPattern(
    'ListView',
    'docs/src/react/workspace/kit/ViewAdapters.tsx',
    props({ cards: false }),
  );
  t.after(() => h.dispose());
  assert.ok(h.document.querySelector('.kit-record-list [data-record-id="ORDER-0"]'));
  assert.equal(h.document.querySelector('[data-card-kind]'), null);
  assert.match(h.document.body.textContent, /Restricted/);
});

const legacyRecord = {
  id: 'ORDER-LEGACY',
  title: 'Review order',
  customer: 'Customer studio',
  status: 'pending',
  payment: 'unpaid',
  delivery: 'planned',
  owner: 'Alex Reed',
  city: 'Istanbul',
  amount: 0,
  currency: 'EUR',
  start: '2026-10-14',
  due: '2026-10-20',
  priority: 'normal',
  notes: '',
  readOnly: false,
  lines: [],
};
const legacyProps = (overrides = {}) => ({
  view: 'table',
  profile: 'mobile',
  records: [legacyRecord],
  allRecords: [legacyRecord],
  checkedIds: [],
  onSelectionChange: () => {},
  activeId: null,
  onOpen: () => {},
  onEdit: () => {},
  editingId: null,
  visibleColumns: ['customer', 'status', 'amount', 'due'],
  groupKey: 'status',
  onGroupChange: () => {},
  expandedIds: [],
  onExpandedChange: () => {},
  calendarMonth: '2026-10',
  onMonthChange: () => {},
  differencesOnly: false,
  onDifferencesChange: () => {},
  deferredIds: [],
  onApprove: () => {},
  onDefer: () => {},
  onRestoreDeferred: () => {},
  onStatusChange: () => {},
  editor: null,
  bulkPanel: null,
  ...overrides,
});

test('legacy mobile table cards reuse EntityCard while retaining opener IDs and host callbacks', async t => {
  const opened = [],
    checked = [];
  const h = await mountPattern(
    'default',
    'docs/src/react/workspace/CollectionViews.tsx',
    legacyProps({
      onOpen: record => opened.push(record),
      onSelectionChange: ids => checked.push(ids),
    }),
  );
  t.after(() => h.dispose());
  const card = h.document.querySelector('[data-card-kind="entity"]');
  assert.ok(card);
  assert.match(card.textContent, /Customer studio/);
  assert.match(card.textContent, /€0\.00/);
  await h.click(h.document.getElementById('collection-open-ORDER-LEGACY'));
  assert.deepEqual(opened, [legacyRecord]);
  await h.click(card.querySelector('input[type="checkbox"]'));
  assert.deepEqual(checked, [['ORDER-LEGACY']]);
});

test('legacy EntityCards preserve the palette identity of all four raw-status values', async t => {
  const statuses = { draft: 'red', pending: 'orange', approved: 'green', shipped: 'cyan-blue' };
  const records = Object.keys(statuses).map(status => ({
    ...legacyRecord,
    id: `raw-${status}`,
    status,
  }));
  const fixture = `.card-workspace-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import CollectionViews from '../src/react/workspace/CollectionViews'; import GenUXProvider from '../src/react/GenUXProvider'; export default function Palette(props){ return <GenUXProvider appearance="docs"><CollectionViews {...props}/></GenUXProvider>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern(
    'default',
    'docs/tests/' + fixture,
    legacyProps({ records, allRecords: records }),
  );
  t.after(() => h.dispose());
  const fills = new Set();
  for (const [status, expected] of Object.entries(statuses)) {
    const pill = h.document.querySelector(`[data-card-id="raw-${status}"] .genux-pill`);
    assert.ok(pill, status);
    assert.equal(pill.dataset.pillColor, expected, `${status} retains the stable shared preset`);
    fills.add(pill.style.getPropertyValue('--pill-bg'));
  }
  assert.equal(fills.size, 4, 'the actual managed status backgrounds remain distinct');
  await h.act(() => h.setLocale('tr'));
  for (const [status, expected] of Object.entries(statuses)) {
    assert.equal(
      h.document.querySelector(`[data-card-id="raw-${status}"] .genux-pill`).dataset.pillColor,
      expected,
    );
  }
});

test('EntityCard collection currency totals retain their distinct stable palette identities', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/CollectionDemo.tsx', {
    documentation: true,
    initialProfile: 'mobile',
  });
  t.after(() => h.dispose());
  const readCurrencies = () =>
    new Map(
      [...h.document.querySelectorAll('.genux-pill')]
        .filter(pill => /^(USD|EUR):/.test(pill.textContent.trim()))
        .map(pill => [pill.textContent.trim().slice(0, 3), pill.dataset.pillColor]),
    );
  const expected = new Map([
    ['USD', 'violet'],
    ['EUR', 'magenta-red'],
  ]);
  assert.deepEqual(readCurrencies(), expected);
  await h.type(h.document.querySelector('#collection-search'), 'Aster');
  for (const [currency, color] of readCurrencies()) assert.equal(color, expected.get(currency));
  await h.type(h.document.querySelector('#collection-search'), '');
  assert.deepEqual(readCurrencies(), expected);
  await h.act(() => h.setLocale('tr'));
  assert.deepEqual(readCurrencies(), expected);
});

test('legacy board cards preserve the real status callback', async t => {
  const moved = [];
  const h = await mountPattern(
    'default',
    'docs/src/react/workspace/CollectionViews.tsx',
    legacyProps({
      view: 'board',
      onStatusChange: (record, status) => moved.push([record.id, status]),
    }),
  );
  t.after(() => h.dispose());
  assert.ok(h.document.querySelector('.collection-board-item [data-card-kind="entity"]'));
  const { selectOption } = await import('./harness.mjs');
  await selectOption(h, h.document.getElementById('collection-status-ORDER-LEGACY'), 'Approved');
  assert.deepEqual(moved, [['ORDER-LEGACY', 'approved']]);
});

test('legacy ordinary List retains its existing presentation', async t => {
  const h = await mountPattern(
    'default',
    'docs/src/react/workspace/CollectionViews.tsx',
    legacyProps({ view: 'list' }),
  );
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('[data-genux-card]'), null);
  assert.ok(h.document.querySelector('.collection-record-content'));
  assert.ok(h.document.getElementById('collection-open-ORDER-LEGACY'));
});
