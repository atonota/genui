import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import postcss from 'postcss';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mountPattern, selectOption } from './harness.mjs';

const temporaryModules = [];
after(async () => Promise.all(temporaryModules.map(path => unlink(path))));
async function moduleAt(path) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    packages: 'external',
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    jsx: 'automatic',
  });
  const modulePath = resolve('docs/tests/.kit-collections-' + randomUUID() + '.mjs');
  await writeFile(modulePath, result.outputFiles[0].contents, { flag: 'wx' });
  temporaryModules.push(modulePath);
  return import(pathToFileURL(modulePath).href);
}
const tools = await moduleAt('docs/src/data/collection-kit.ts');
const grid = tools;
const model = await moduleAt('docs/src/data/workspace-kit.ts');
const records = [
  { id: 'a', title: 'DocType Template Proposal', amount: 0, status: 'open' },
  { id: 'b', title: 'Proposal', amount: 20, status: 'open' },
  { id: 'c', title: 'Template', amount: null, status: 'closed' },
];
const fields = [
  {
    key: 'title',
    label: 'Title',
    kind: 'text',
    getValue: r => r.title,
    setValue: (r, value) => ({ ...r, title: String(value ?? '') }),
    required: true,
  },
  {
    key: 'amount',
    label: 'Amount',
    kind: 'number',
    getValue: r => r.amount,
    setValue: (r, value) => ({ ...r, amount: value }),
    validate: value =>
      value !== null && (typeof value !== 'number' || value < 0)
        ? 'Enter a non-negative amount.'
        : null,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'choice',
    getValue: r => r.status,
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
];

test('controlled collection query keeps typed values, independent directions and stable input', () => {
  const query = {
    search: '',
    filters: [{ id: 'f1', fieldKey: 'amount', operator: 'gte', value: 0 }],
    sort: [
      { fieldKey: 'status', direction: 'asc' },
      { fieldKey: 'amount', direction: 'desc' },
    ],
  };
  assert.deepEqual(
    model.queryKitRecords(records, fields, query).map(r => r.id),
    ['b', 'a'],
  );
  assert.equal(records[0].amount, 0);
  assert.equal(records[2].amount, null);
  assert.equal(query.sort[0].direction, 'asc');
  assert.equal(query.sort[1].direction, 'desc');
  assert.deepEqual(
    model
      .queryKitRecords(records, fields, {
        ...query,
        filters: [{ id: 'f1', fieldKey: 'amount', operator: 'eq', value: 0 }],
      })
      .map(r => r.id),
    ['a'],
  );
});

test('smart group counts distinguish unique records from overlapping memberships', () => {
  const definitions = [
    { id: 'open', label: 'Open', kind: 'overlapping', matches: r => r.status === 'open' },
    { id: 'zero', label: 'Zero', kind: 'overlapping', matches: r => r.amount === 0 },
  ];
  const result = tools.groupMemberships(records, definitions);
  assert.equal(result.uniqueCount, 2);
  assert.equal(result.membershipCount, 3);
  assert.deepEqual(
    result.groups.map(g => g.records.map(r => r.id)),
    [['a', 'b'], ['a']],
  );
  assert.equal(tools.scopeGroupRecords(records, result.groups, 'zero')[0].id, 'a');
  assert.equal(tools.scopeGroupRecords(records, result.groups, null).length, 3);
});

test('saved view input is validated before loading and excludes record selection/drafts', () => {
  const valid = {
    version: 1,
    name: 'My view',
    query: { search: '', filters: [], sort: [{ fieldKey: 'amount', direction: 'desc' }] },
    projection: ['title', 'amount'],
    group: { fieldKey: null },
    view: 'table',
  };
  assert.deepEqual(tools.parseSavedView(JSON.stringify(valid), fields).value, valid);
  assert.ok(
    tools.parseSavedView(JSON.stringify({ ...valid, projection: ['missing'] }), fields).error,
  );
  assert.ok(
    tools.parseSavedView(
      JSON.stringify({
        ...valid,
        query: {
          ...valid.query,
          filters: [{ id: 'x', fieldKey: 'amount', operator: 'gte', value: 'twenty' }],
        },
      }),
      fields,
    ).error,
  );
  assert.ok(tools.parseSavedView(JSON.stringify({ ...valid, checkedIds: ['a'] }), fields).error);
  assert.ok(tools.parseSavedView('{', fields).error);
  assert.ok(
    tools.parseSavedView(
      JSON.stringify({
        ...valid,
        query: {
          ...valid.query,
          filters: [{ id: '__proto__', fieldKey: 'amount', operator: 'gte', value: 'invalid' }],
        },
      }),
      fields,
    ).error,
  );
  assert.ok(
    tools.parseSavedView(JSON.stringify({ ...valid, group: { fieldKey: 1 } }), fields).error,
  );
});

test('grid validates all changed rows and commits stable identities without changing source records', () => {
  const drafts = { a: { ...records[0], amount: 5 }, b: { ...records[1], amount: -2 } };
  assert.equal(Object.keys(grid.validateGridDrafts(records, drafts, fields)).length, 1);
  const invalid = grid.prepareGridCommit(records, drafts, fields);
  assert.equal(invalid.records.length, 0);
  assert.ok(invalid.errors.b.amount);
  const result = grid.prepareGridCommit(
    records,
    { ...drafts, b: { ...drafts.b, amount: 25 } },
    fields,
  );
  assert.deepEqual(
    result.records.map(r => r.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    result.records.map(r => r.amount),
    [5, 25],
  );
  assert.equal(records[0].amount, 0);
  assert.ok(
    grid.prepareGridCommit(records, { a: { ...drafts.a, id: 'other' } }, fields).errors.a.id,
  );
  assert.ok(
    grid.prepareGridCommit(records, { ghost: { ...records[0], id: 'ghost' } }, fields).errors.ghost
      .id,
  );
});

test('filter draft only changes the controlled query after explicit apply', async t => {
  const applied = [];
  const h = await mountPattern('QueryBar', 'docs/src/react/workspace/kit/CollectionTools.tsx', {
    fields,
    query: { search: '', filters: [], sort: [] },
    onQueryChange: q => applied.push(q),
  });
  t.after(() => h.dispose());
  await h.click(
    [...h.document.querySelectorAll('button')].find(b => b.textContent.includes('Add filter')),
  );
  assert.equal(applied.length, 0);
  const value = h.document.querySelector('[data-filter-value] input');
  assert.ok(value);
  await h.type(value, 'Proposal');
  assert.equal(applied.length, 0);
  await h.click(
    [...h.document.querySelectorAll('button')].find(b => b.textContent.includes('Apply filters')),
  );
  assert.equal(applied.length, 1);
  assert.equal(applied[0].filters[0].value, 'Proposal');
});

test('portable collection projection keeps record scope and grid commits multiple controlled row drafts', async t => {
  const fixturePath = 'docs/tests/.kit-controlled-' + randomUUID() + '.tsx';
  await writeFile(
    fixturePath,
    `import {useState} from 'react';
 import RecordCollection from '../src/react/workspace/kit/RecordCollection';
 import EditableGrid from '../src/react/workspace/kit/EditableGrid';
 export default function Controlled(props){
  const [records,setRecords]=useState(props.records);const [drafts,setDrafts]=useState({});const [projection,setProjection]=useState(['title','amount']);const [query,setQuery]=useState({search:'',filters:[],sort:[]});const [active,setActive]=useState(null);const [checked,setChecked]=useState([]);const [group,setGroup]=useState({fieldKey:null,activeGroupId:null});const groups=[{id:'open',label:'Open records',kind:'overlapping',matches:record=>record.status==='open'},{id:'zero',label:'Zero amount',kind:'overlapping',matches:record=>record.amount===0}];
  return <><RecordCollection records={records} fields={props.fields} query={query} onQueryChange={setQuery} activeId={active} onActiveIdChange={setActive} checkedIds={checked} onCheckedIdsChange={setChecked} group={group} onGroupChange={setGroup} groups={groups} projection={projection} onProjectionChange={setProjection}/><EditableGrid records={records} fields={props.fields} drafts={drafts} onDraftsChange={setDrafts} onCancel={()=>{}} onCommit={changes=>{setRecords(current=>current.map(record=>changes.find(next=>next.id===record.id)??record));setDrafts({});}}/><output data-controlled-records>{JSON.stringify(records)}</output></>;
 }`,
  );
  let h;
  t.after(async () => {
    if (h) await h.dispose();
    await unlink(fixturePath);
  });
  h = await mountPattern('default', fixturePath, { records, fields });
  const buttons = () => [...h.document.querySelectorAll('button')];
  await h.click(buttons().find(button => button.textContent.trim() === 'View settings'));
  const projectionBox = [...h.document.querySelectorAll('.kit-projection label')]
    .find(label => label.textContent.trim() === 'Amount')
    .querySelector('input');
  await h.click(projectionBox);
  assert.match(h.document.querySelector('.kit-collection > p[role=status]').textContent, /3 of 3/);
  assert.equal(h.document.querySelectorAll('.kit-collection .kit-table tbody tr').length, 3);
  await h.click(buttons().find(button => button.textContent.trim() === 'Edit Title for a'));
  const first = h.document.querySelector('.kit-editable-grid [data-editing-cell=true] input');
  await h.type(first, 'Edited first record');
  await h.act(async () =>
    first.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  assert.equal(h.document.activeElement.dataset.editTrigger, 'a::title');
  await h.click(buttons().find(button => button.textContent.trim() === 'Edit Title for b'));
  const second = h.document.querySelector('.kit-editable-grid [data-editing-cell=true] input');
  await h.type(second, 'Edited second record');
  await h.act(async () =>
    second.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  assert.match(
    h.document.querySelector('.kit-editable-grid [role=status]').textContent,
    /2 row drafts/,
  );
  assert.equal(
    JSON.parse(h.document.querySelector('[data-controlled-records]').textContent)[0].title,
    records[0].title,
  );
  assert.match(
    h.document.querySelector('.kit-group-nav').textContent,
    /2 unique records; 3 group memberships/,
  );
  await h.click(buttons().find(button => button.textContent.trim() === 'Open b'));
  await h.click(buttons().find(button => button.textContent.trim() === 'Zero amount (1)'));
  assert.match(h.document.querySelector('.kit-collection > p[role=status]').textContent, /1 of 3/);
  assert.match(
    h.document.querySelector('.kit-collection').textContent,
    /inspected record is outside/,
  );
  assert.match(
    h.document.querySelector('.kit-editable-grid [role=status]').textContent,
    /2 row drafts/,
  );
  await h.click(buttons().find(button => button.textContent.trim() === 'All records (3)'));
  await h.click(buttons().find(button => button.textContent.trim() === 'Commit all drafts'));
  const committed = JSON.parse(h.document.querySelector('[data-controlled-records]').textContent);
  assert.equal(committed[0].title, 'Edited first record');
  assert.equal(committed[1].title, 'Edited second record');
  assert.equal(committed[2].title, records[2].title);
  assert.deepEqual(
    committed.map(record => record.id),
    ['a', 'b', 'c'],
  );
  assert.match(
    h.document.querySelector('.kit-editable-grid [role=status]').textContent,
    /0 row drafts/,
  );
});

test('grid edit and commit never read unavailable field getters and reject writes outside declared editors', () => {
  for (const state of ['restricted', 'unavailable', 'not-applicable', 'unknown']) {
    let forbiddenReads = 0;
    const original = {
      id: 'locked-' + state,
      title: 'Readable title',
      secret: 'Preserved opaque value',
      status: 'open',
    };
    const protectedFields = [
      fields[0],
      {
        key: 'masked-value',
        label: 'Protected value',
        kind: 'text',
        availability: () => ({ state, reason: 'Value is unavailable.' }),
        getValue: () => {
          forbiddenReads++;
          throw new Error('Forbidden protected getter');
        },
        setValue: (record, value) => ({ ...record, secret: value }),
      },
      fields[2],
    ];
    const allowedDraft = { ...original, title: 'Edited readable title' };
    assert.doesNotThrow(() =>
      grid.validateGridDrafts([original], { [original.id]: allowedDraft }, protectedFields),
    );
    const allowed = grid.prepareGridCommit(
      [original],
      { [original.id]: allowedDraft },
      protectedFields,
    );
    assert.equal(allowed.records.length, 1);
    assert.equal(allowed.records[0].secret, original.secret);
    const denied = grid.prepareGridCommit(
      [original],
      { [original.id]: { ...allowedDraft, secret: 'Forbidden replacement' } },
      protectedFields,
    );
    assert.equal(denied.records.length, 0);
    assert.ok(denied.errors[original.id]);
    assert.equal(
      forbiddenReads,
      0,
      'Restricted/unknown values must not be read for dirty checks or commit validation',
    );
  }
});

test('grid Escape and row focus retain unavailable values without evaluating protected getters', async t => {
  let forbiddenReads = 0;
  const original = {
    id: 'protected-a',
    title: 'Original title',
    secret: 'Opaque value',
    status: 'open',
  };
  const protectedFields = [
    fields[0],
    {
      key: 'secret',
      label: 'Protected value',
      kind: 'text',
      availability: () => ({ state: 'restricted', reason: 'Value is unavailable.' }),
      getValue: () => {
        forbiddenReads++;
        throw new Error('Forbidden protected getter');
      },
      setValue: (record, value) => ({ ...record, secret: value }),
    },
    fields[2],
  ];
  const fixturePath = 'docs/tests/.kit-protected-grid-' + randomUUID() + '.tsx';
  await writeFile(
    fixturePath,
    `import {useState} from 'react';import EditableGrid from '../src/react/workspace/kit/EditableGrid';export default function Controlled(props){const [drafts,setDrafts]=useState({});const [records,setRecords]=useState(props.records);return <><EditableGrid records={records} fields={props.fields} drafts={drafts} onDraftsChange={setDrafts} onCancel={()=>{}} onCommit={changes=>{setRecords(changes);setDrafts({});}}/><output data-protected-records>{JSON.stringify(records)}</output></>;}`,
  );
  let h;
  t.after(async () => {
    if (h) await h.dispose();
    await unlink(fixturePath);
  });
  h = await mountPattern('default', fixturePath, { records: [original], fields: protectedFields });
  const buttons = () => [...h.document.querySelectorAll('button')];
  await h.click(
    buttons().find(button => button.textContent.trim() === 'Edit Title for protected-a'),
  );
  let editor = h.document.querySelector('[data-editing-cell=true] input');
  await h.type(editor, 'Will be cancelled');
  await h.act(async () =>
    editor.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  assert.match(
    h.document.querySelector('.kit-editable-grid [role=status]').textContent,
    /0 row drafts/,
  );
  assert.equal(
    JSON.parse(h.document.querySelector('[data-protected-records]').textContent)[0].title,
    'Original title',
  );
  await selectOption(h, h.document.querySelector('.kit-editable-grid .ant-select'), 'Row editing');
  await h.click(
    buttons().find(button => button.textContent.trim() === 'Edit Title for protected-a'),
  );
  const protectedCell = h.document.querySelector(
    'td[data-kind=text]:has([data-field-value=secret])',
  );
  assert.ok(protectedCell);
  await h.act(async () =>
    protectedCell.dispatchEvent(new h.window.FocusEvent('focusin', { bubbles: true })),
  );
  editor = h.document.querySelector('[data-editing-cell=true] input');
  await h.type(editor, 'Committed readable title');
  await h.click(buttons().find(button => button.textContent.trim() === 'Commit all drafts'));
  const committed = JSON.parse(h.document.querySelector('[data-protected-records]').textContent)[0];
  assert.equal(committed.title, 'Committed readable title');
  assert.equal(committed.secret, 'Opaque value');
  assert.equal(forbiddenReads, 0);
});

test('a grid draft cannot make originally restricted values readable by changing metadata', () => {
  let forbiddenReads = 0;
  const original = { id: 'guarded', title: 'Original', secret: 'Opaque', restricted: true };
  const schema = [
    fields[0],
    {
      key: 'secret',
      label: 'Secret',
      kind: 'text',
      availability: record => ({ state: record.restricted ? 'restricted' : 'available' }),
      getValue: () => {
        forbiddenReads++;
        throw new Error('Forbidden getter');
      },
      setValue: (record, value) => ({ ...record, secret: value }),
    },
  ];
  const result = grid.prepareGridCommit(
    [original],
    { guarded: { ...original, title: 'Changed', restricted: false, secret: 'Replacement' } },
    schema,
  );
  assert.equal(result.records.length, 0);
  assert.ok(result.errors.guarded);
  assert.equal(forbiddenReads, 0);
});

test('grid commit copies opaque property descriptors without invoking accessors', () => {
  let reads = 0;
  const original = Object.defineProperty({ id: 'opaque', title: 'Original' }, 'secret', {
    enumerable: true,
    configurable: true,
    get() {
      reads++;
      throw new Error('Opaque accessor evaluated');
    },
  });
  const setTitle = (record, value) => {
    const descriptors = Object.getOwnPropertyDescriptors(record);
    descriptors.title = { ...descriptors.title, value: String(value) };
    return Object.defineProperties({}, descriptors);
  };
  const schema = [
    {
      key: 'title',
      label: 'Title',
      kind: 'text',
      getValue: record => record.title,
      setValue: setTitle,
    },
    {
      key: 'secret',
      label: 'Secret',
      kind: 'text',
      availability: () => ({ state: 'restricted' }),
      getValue: record => record.secret,
    },
  ];
  const draft = setTitle(original, 'Changed');
  const result = grid.prepareGridCommit([original], { opaque: draft }, schema);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, 'Changed');
  assert.equal(
    Object.getOwnPropertyDescriptor(result.records[0], 'secret').get,
    Object.getOwnPropertyDescriptor(original, 'secret').get,
  );
  assert.equal(reads, 0);
});

test('record list selection changes paint without changing padding geometry', async () => {
  const sheet = postcss.parse(await readFile('docs/src/styles/kit-collections.css', 'utf8'));
  const baseline = sheet.nodes.find(
    node =>
      node.type === 'rule' && node.selector === ':is(.kit-record-list, .kit-record-cards) > li',
  );
  assert.ok(
    baseline.nodes.some(
      node => node.type === 'decl' && node.prop === 'padding' && node.value === 'var(--space-md)',
    ),
  );
  sheet.walkRules(rule => {
    if (rule.selector.includes('.kit-record-list') && rule.selector.includes('[data-active'))
      assert.ok(
        !rule.nodes.some(
          node =>
            node.type === 'decl' && /^(padding|margin|width|height|transform)/.test(node.prop),
        ),
        'selected row must retain the base hit-area geometry',
      );
  });
});

test('composite table columns retain typed leaf values and independent subfield query semantics', async t => {
  let protectedReads = 0;
  const updates = [];
  const compositeFields = [
    fields[0],
    { ...fields[1], kind: 'money', currency: 'USD', precision: 2 },
    {
      key: 'secret',
      label: 'Protected value',
      kind: 'text',
      availability: () => ({ state: 'restricted', reason: 'Value is unavailable.' }),
      getValue: () => {
        protectedReads++;
        throw new Error('Protected getter must not run');
      },
    },
    fields[2],
  ];
  const compositeRecords = [
    { ...records[0], secret: 'Opaque' },
    { ...records[2], secret: 'Opaque' },
  ];
  const query = { search: '', filters: [], sort: [{ fieldKey: 'title', direction: 'asc' }] };
  const h = await mountPattern('TableView', 'docs/src/react/workspace/kit/ViewAdapters.tsx', {
    records: compositeRecords,
    fields: compositeFields,
    query,
    onQueryChange: value => updates.push(value),
    activeId: null,
    onActiveIdChange: () => {},
    checkedIds: [],
    onCheckedIdsChange: () => {},
    projection: ['title', 'amount', 'secret', 'status'],
    onProjectionChange: () => {},
    columns: [
      {
        key: 'summary',
        label: 'Record summary',
        fieldKeys: ['title', 'amount', 'secret', 'missing', 'amount'],
      },
      { key: 'duplicate', label: 'Duplicate group', fieldKeys: ['amount', 'missing'] },
      { key: 'summary', label: 'Repeated key', fieldKeys: ['status'] },
    ],
  });
  t.after(() => h.dispose());
  const group = h.document.querySelector('th[scope=colgroup]');
  assert.ok(group, 'composite header must group existing visible leaf fields');
  assert.equal(group.textContent, 'Record summary');
  assert.equal(group.colSpan, 3);
  assert.equal(
    h.document.querySelectorAll('th[scope=colgroup]').length,
    1,
    'duplicate/missing fields and duplicate group keys do not create empty/repeated columns',
  );
  assert.equal(
    h.document.querySelectorAll('tbody tr').length,
    2,
    'column grouping does not change record scope',
  );
  const cells = [...h.document.querySelectorAll('td[data-column-type=composite]')];
  assert.equal(cells.length, 2);
  assert.equal(cells[0].colSpan, 3);
  assert.match(
    cells[0].textContent,
    /Title.*DocType Template Proposal.*Amount.*\$0\.00.*Protected value.*Restricted/s,
  );
  assert.match(cells[1].textContent, /Amount.*Not set/s);
  for (const row of h.document.querySelectorAll('tbody tr')) {
    const identity = row.querySelector('th[scope=row]');
    assert.ok(identity.id, 'record identity must have a table-scoped header ID');
    for (const cell of row.querySelectorAll('td')) {
      const headerIds = cell.getAttribute('headers')?.split(/\s+/) ?? [];
      assert.ok(headerIds.includes(identity.id), 'each cell must include its record identity');
      assert.ok(headerIds.every(id => h.document.getElementById(id)?.tagName === 'TH'));
      if (cell.dataset.columnType === 'composite') {
        assert.ok(headerIds.includes(group.id));
        const leaves = headerIds
          .map(id => h.document.getElementById(id).dataset.leafField)
          .filter(Boolean);
        assert.deepEqual(leaves, ['title', 'amount', 'secret']);
      } else if (cell.dataset.leafField) {
        assert.ok(
          headerIds.some(
            id => h.document.getElementById(id).dataset.leafField === cell.dataset.leafField,
          ),
        );
      }
    }
  }
  assert.ok(
    h.document.querySelector('tbody td[data-leaf-field=status]'),
    'ungrouped leaf remains an individual column',
  );
  const buttons = () => [...h.document.querySelectorAll('button')];
  await h.click(buttons().find(button => button.textContent.trim() === 'Sort Amount'));
  assert.deepEqual(updates.at(-1).sort, [
    { fieldKey: 'amount', direction: 'asc' },
    { fieldKey: 'title', direction: 'asc' },
  ]);
  const amountHeader = h.document.querySelector('th[data-leaf-field=amount]');
  await h.click(
    [...amountHeader.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Filter Amount',
    ),
  );
  await h.type(amountHeader.querySelector('input'), '0');
  await h.click(
    [...amountHeader.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Apply Amount filter',
    ),
  );
  assert.deepEqual(updates.at(-1).filters, [
    { id: 'header-amount', fieldKey: 'amount', operator: 'eq', value: 0 },
  ]);
  assert.deepEqual(
    updates.at(-1).sort,
    query.sort,
    'subfield filtering preserves independently controlled sorting',
  );
  assert.equal(protectedReads, 0);
  assert.equal(model.queryKitRecords(compositeRecords, compositeFields, updates.at(-1)).length, 1);
});
