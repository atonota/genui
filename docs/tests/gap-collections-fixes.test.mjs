import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import { mountPattern, selectOption } from './harness.mjs';

const modules = [];
after(() => Promise.all(modules.map(path => unlink(path))));
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
  const output = resolve('docs/tests/.gap-collection-' + randomUUID() + '.mjs');
  await writeFile(output, result.outputFiles[0].contents, { flag: 'wx' });
  modules.push(output);
  return import(pathToFileURL(output).href);
}
const model = await moduleAt('docs/src/data/collection-kit.ts');
const records = [
  {
    id: 'a',
    title: 'Parent',
    status: 'open',
    start: '2026-10-10',
    due: '2026-10-13',
    location: 'Istanbul',
  },
  {
    id: 'b',
    title: 'Child',
    status: 'open',
    start: '2026-10-12',
    due: '2026-10-14',
    location: 'Berlin',
    parent: 'a',
  },
  { id: 'c', title: 'Unscheduled', status: 'closed', start: null, due: null, location: 'London' },
];
const fields = [
  { key: 'id', label: 'Record ID', kind: 'text', getValue: row => row.id },
  {
    key: 'title',
    label: 'Title',
    kind: 'text',
    getValue: row => row.title,
    setValue: (row, value) => ({ ...row, title: String(value ?? '') }),
    required: true,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'choice',
    getValue: row => row.status,
    options: [
      { value: 'open', label: 'Pending approval' },
      { value: 'closed', label: 'Approved' },
      { value: 'empty', label: 'Shipped' },
    ],
  },
  { key: 'start', label: 'Start date', kind: 'date', getValue: row => row.start },
  { key: 'due', label: 'Due date', kind: 'date', getValue: row => row.due },
  {
    key: 'location',
    label: 'Location',
    kind: 'text',
    getValue: row => row.location,
    setValue: (row, value) => ({ ...row, location: String(value ?? '') }),
    required: true,
  },
];
const base = {
  records,
  fields,
  query: { search: '', filters: [], sort: [] },
  onQueryChange: () => {},
  activeId: 'a',
  onActiveIdChange: () => {},
  checkedIds: [],
  onCheckedIdsChange: () => {},
  projection: ['title', 'status'],
  onProjectionChange: () => {},
};
const buttons = h => [...h.document.querySelectorAll('button')];
const named = (h, name) => buttons(h).find(button => button.textContent.trim() === name);

async function controlled(t, source, props = {}) {
  const path = 'docs/tests/.gap-controlled-' + randomUUID() + '.tsx';
  await writeFile(path, source);
  let h;
  t.after(async () => {
    if (h) await h.dispose();
    await unlink(path);
  });
  h = await mountPattern('default', path, props);
  return h;
}

test('board lanes use independent choice labels, empty options and keyboard scroll semantics', async t => {
  const h = await mountPattern('ViewAdapter', 'docs/src/react/workspace/kit/ViewAdapters.tsx', {
    ...base,
    view: 'board',
    boardFieldKey: 'status',
    group: { fieldKey: null },
    groups: [{ id: 'all', label: 'All', kind: 'overlapping', matches: () => true }],
  });
  t.after(() => h.dispose());
  const board = h.document.querySelector('.kit-board');
  assert.ok(board);
  assert.equal(board.tabIndex, 0);
  assert.match(board.textContent, /Pending approval \(2\)/);
  assert.match(board.textContent, /Shipped \(0\)/);
  await h.act(() => h.setLocale('tr'));
  assert.match(board.textContent, /Onay bekliyor \(2\)/);
  assert.doesNotMatch(board.textContent, /open \(2\)/);
  assert.equal(board.querySelector('[data-record-id=a]')?.getAttribute('aria-current'), 'true');
});

test('calendar renders a navigable month grid instead of the event timeline alias', async t => {
  const h = await mountPattern('ViewAdapter', 'docs/src/react/workspace/kit/ViewAdapters.tsx', {
    ...base,
    view: 'calendar',
    dateFieldKey: 'due',
  });
  t.after(() => h.dispose());
  assert.ok(h.document.querySelector('[data-calendar-day="2026-10-13"]'));
  assert.equal(h.document.querySelector('.kit-event-timeline'), null);
  assert.match(h.document.querySelector('[data-calendar-day="2026-10-13"]').textContent, /Parent/);
  await h.click(named(h, 'Next month'));
  assert.ok(h.document.querySelector('[data-calendar-day="2026-11-01"]'));
  assert.match(
    h.document.querySelector('.kit-calendar-scope').textContent,
    /0 records in this month; 2 dated records outside it; 1 records without an available date/,
  );
  const outside = named(h, 'Show dated records outside this month (2)');
  assert.ok(outside);
  await h.click(outside);
  assert.equal(outside.getAttribute('aria-expanded'), 'true');
  assert.match(h.document.querySelector('.kit-calendar-outside').textContent, /Parent.*Child/s);
  await h.click(named(h, 'Previous month'));
  assert.ok(h.document.querySelector('[data-calendar-day="2026-10-13"]'));
});

test('date-span Gantt and hierarchy adapters consume their advertised fields', async t => {
  const gantt = await mountPattern('ViewAdapter', 'docs/src/react/workspace/kit/ViewAdapters.tsx', {
    ...base,
    view: 'gantt',
    startFieldKey: 'start',
    endFieldKey: 'due',
  });
  let ganttDisposed = false;
  t.after(() => (ganttDisposed ? undefined : gantt.dispose()));
  assert.equal(gantt.document.querySelectorAll('[data-gantt-record]').length, 2);
  assert.equal(
    gantt.document.querySelector('[data-gantt-record=a]').getAttribute('data-start'),
    '2026-10-10',
  );
  assert.match(gantt.document.body.textContent, /Unscheduled/);
  await gantt.dispose();
  ganttDisposed = true;
  const tree = await mountPattern('ViewAdapter', 'docs/src/react/workspace/kit/ViewAdapters.tsx', {
    ...base,
    view: 'tree',
    parentId: row => row.parent ?? null,
  });
  t.after(() => tree.dispose());
  const expand = tree.document.querySelector('[data-tree-expand=a]');
  assert.ok(expand);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(tree.document.querySelector('[data-record-id=b]'), null);
  await tree.click(expand);
  assert.ok(tree.document.querySelector('[data-record-id=b]'));
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
});

test('unknown grid operations block commits and cancellation while exposing per-record outcomes', async t => {
  let commits = 0,
    cancels = 0;
  const h = await mountPattern('EditableGrid', 'docs/src/react/workspace/kit/EditableGrid.tsx', {
    records,
    fields,
    projection: ['title'],
    drafts: { a: { ...records[0], title: 'Changed' } },
    onDraftsChange: () => {},
    onCommit: () => commits++,
    onCancel: () => cancels++,
    operation: { kind: 'unknown', message: 'Await the original result.', failedIds: ['a'] },
  });
  t.after(() => h.dispose());
  assert.equal(named(h, 'Commit all drafts').disabled, true);
  assert.equal(named(h, 'Cancel all drafts').disabled, true);
  await h.click(named(h, 'Commit all drafts'));
  assert.equal(commits, 0);
  assert.equal(cancels, 0);
  assert.match(h.document.body.textContent, /Await the original result/);
  assert.equal(h.document.querySelector('[data-grid-row=a]').dataset.operationResult, 'failed');
});

test('grid reports hidden-field errors and rejects a stale baseline without replacing new data', async t => {
  const baseline = { ...records[0] },
    current = { ...baseline, location: 'New server location' },
    draft = { ...baseline, title: 'Authored draft' };
  const stale = model.prepareGridCommit([current], { a: draft }, fields, undefined, {
    a: baseline,
  });
  assert.equal(stale.records.length, 0);
  assert.match(stale.errors.a.$record, /changed after this draft began/);
  const h = await mountPattern('EditableGrid', 'docs/src/react/workspace/kit/EditableGrid.tsx', {
    records,
    fields,
    projection: ['title'],
    drafts: { a: { ...records[0], title: 'Changed', location: '' } },
    onDraftsChange: () => {},
    onCommit: () => assert.fail('invalid hidden field committed'),
    onCancel: () => {},
  });
  t.after(() => h.dispose());
  await h.click(named(h, 'Commit all drafts'));
  assert.match(
    h.document.querySelector('[data-grid-row=a] th[scope=row]').textContent,
    /Location.*required/s,
  );
});

test('projection preserves authored order and refuses an empty or ignored-ID saved projection', async t => {
  const changes = [];
  const h = await mountPattern(
    'ProjectionPicker',
    'docs/src/react/workspace/kit/CollectionTools.tsx',
    { fields, projection: ['status'], onChange: next => changes.push(next) },
  );
  t.after(() => h.dispose());
  const boxes = [...h.document.querySelectorAll('.kit-projection .ant-checkbox-wrapper')];
  assert.ok(!boxes.some(label => label.textContent.trim() === 'Record ID'));
  assert.equal(
    boxes.find(label => label.textContent.trim() === 'Status').querySelector('input').disabled,
    true,
  );
  await h.click(boxes.find(label => label.textContent.trim() === 'Title').querySelector('input'));
  assert.deepEqual(changes.at(-1), ['status', 'title']);
  const saved = {
    version: 1,
    name: 'Invalid projection',
    query: base.query,
    projection: [],
    group: { fieldKey: null },
    view: 'table',
  };
  assert.ok(model.parseSavedView(JSON.stringify(saved), fields).error);
  assert.ok(model.parseSavedView(JSON.stringify({ ...saved, projection: ['id'] }), fields).error);
});

test('header filters disclose editors and clear their draft value when removed', async t => {
  const h = await controlled(
    t,
    `import {useState} from 'react';import {TableView} from '../src/react/workspace/kit/ViewAdapters';export default function Fixture(props){const [query,setQuery]=useState({search:'',filters:[],sort:[]});return <TableView {...props} query={query} onQueryChange={setQuery}/>}`,
    base,
  );
  const header = h.document.querySelector('th[data-leaf-field=title]');
  assert.ok(header);
  assert.ok(header.querySelector('[aria-expanded=false]'));
  await h.click(
    [...header.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Filter Title',
    ),
  );
  const input = header.querySelector('input');
  await h.type(input, 'Parent');
  await h.click(
    [...header.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Apply Title filter',
    ),
  );
  await h.click(
    [...header.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Clear Title filter',
    ),
  );
  assert.equal(input.value, '');
});

test('ready collection state cannot hide computed no-match and pagination bounds rendered rows', async t => {
  const rows = Array.from({ length: 55 }, (_, index) => ({ ...records[0], id: 'row-' + index }));
  const h = await controlled(
    t,
    `import {useState} from 'react';import RecordCollection from '../src/react/workspace/kit/RecordCollection';export default function Fixture(props){const [query,setQuery]=useState(props.query);return <RecordCollection {...props} query={query} onQueryChange={setQuery}/>}`,
    { ...base, records: rows, activeId: null, pageSize: 10, state: { kind: 'ready' } },
  );
  assert.equal(h.document.querySelectorAll('.kit-table tbody tr').length, 10);
  assert.ok(h.document.querySelector('.kit-table caption'));
  await h.click(named(h, 'Next page'));
  assert.equal(h.document.querySelector('.kit-table tbody th[scope=row]').textContent, 'row-10');
  const search = h.document.querySelector('.kit-query-bar input');
  await h.type(search, 'missing-query');
  assert.equal(h.document.querySelector('.kit-table'), null);
  assert.match(h.document.body.textContent, /No records match this query and group scope/);
});

test('collection focus and sticky headers use non-surrounding immediate source markers', async () => {
  const sheet = postcss.parse(await readFile('docs/src/styles/kit-collections.css', 'utf8'));
  let focus = false,
    sticky = false;
  sheet.walkRules(rule => {
    if (rule.selector.includes('.kit-table thead'))
      sticky ||= rule.nodes.some(node => node.prop === 'position' && node.value === 'sticky');
  });
  const shared = postcss.parse(await readFile('docs/src/styles/components.css', 'utf8'));
  shared.walkRules(rule => {
    if (
      rule.selector.includes('.ant-checkbox-wrapper:not(:has(> span:nth-child(2)))') &&
      rule.selector.includes('focus-visible') &&
      rule.selector.endsWith('::before')
    )
      focus ||= rule.nodes.some(
        node => node.prop === 'background' && node.value === 'var(--focus-color)',
      );
  });
  assert.ok(focus, 'label-less record checkboxes need a visible single-edge focus marker');
  assert.ok(sticky, 'long table headers keep context inside the scroll container');
});

test('an invalid visible numeric cell cannot submit the retained last-valid grid value', async t => {
  let commits = 0;
  const numeric = {
    key: 'amount',
    label: 'Amount',
    kind: 'number',
    precision: 2,
    getValue: record => record.amount,
    setValue: (record, value) => ({ ...record, amount: value }),
  };
  const row = { id: 'numeric', title: 'Numeric draft', amount: 1 };
  const h = await controlled(
    t,
    `import {useState} from 'react';import EditableGrid from '../src/react/workspace/kit/EditableGrid';export default function Fixture(props){const [drafts,setDrafts]=useState({numeric:{...props.record,amount:2}});return <EditableGrid records={[props.record]} fields={props.fields} drafts={drafts} onDraftsChange={setDrafts} onCancel={()=>{}} onCommit={props.onCommit}/>}`,
    { record: row, fields: [numeric], onCommit: () => commits++ },
  );
  await h.click(named(h, 'Edit Amount for numeric'));
  const input = h.document.querySelector('[data-editing-cell=true] input');
  await h.type(input, '1.234');
  assert.equal(input.value, '1.234');
  await h.click(named(h, 'Commit all drafts'));
  assert.equal(commits, 0);
  assert.match(h.document.body.textContent, /invalid cell|precision|decimal/i);
});

test('partial grid outcomes submit only remaining drafts and never repeat applied targets', async t => {
  const commits = [];
  const h = await mountPattern('EditableGrid', 'docs/src/react/workspace/kit/EditableGrid.tsx', {
    records,
    fields,
    projection: ['title'],
    drafts: {
      a: { ...records[0], title: 'Applied draft' },
      b: { ...records[1], title: 'Retry draft' },
    },
    onDraftsChange: () => {},
    onCommit: value => commits.push(value),
    onCancel: () => {},
    operation: { kind: 'partial', appliedIds: ['a'], failedIds: ['b'] },
  });
  t.after(() => h.dispose());
  await h.click(named(h, 'Commit all drafts'));
  assert.deepEqual(
    commits[0].map(record => record.id),
    ['b'],
  );
  assert.equal(h.document.querySelector('[data-grid-row=a]').dataset.operationResult, 'applied');
});

test('row Escape clears every invalid raw child and raw-only changes always have a reachable cancel', async t => {
  const h = await controlled(
    t,
    `import {useState} from 'react';import {EditableGrid} from '../src/react/workspace/kit/EditableGrid';
const records=[{id:'a',first:1,second:2}];const fields=['first','second'].map(key=>({key,label:key,kind:'number',precision:2,getValue:row=>row[key],setValue:(row,value)=>({...row,[key]:value})}));
export default function Fixture(){const[drafts,setDrafts]=useState({});return <EditableGrid records={records} fields={fields} drafts={drafts} onDraftsChange={setDrafts} onCommit={()=>{}} onCancel={()=>{}}/>}`,
    {},
  );
  await selectOption(h, h.document.querySelector('.ant-select input'), 'Row editing');
  await h.click(h.document.querySelector('[data-edit-trigger="a::first"]'));
  const inputs = [...h.document.querySelectorAll('input[role="spinbutton"]')];
  assert.equal(inputs.length, 2);
  await h.type(inputs[0], '1.234');
  await h.type(inputs[1], '2.345');
  assert.equal(
    [...h.document.querySelectorAll('button')].find(
      button => button.textContent === 'Cancel all drafts',
    ).disabled,
    false,
  );
  await h.act(() =>
    inputs[0].dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    ),
  );
  assert.equal(h.document.querySelector('[data-edit-trigger="a::first"]').disabled, false);
  await h.click(h.document.querySelector('[data-edit-trigger="a::first"]'));
  assert.deepEqual(
    [...h.document.querySelectorAll('input[role="spinbutton"]')].map(input => input.value),
    ['1', '2'],
  );
});

test('unreadable collection states cannot mount supplied bulk actions and duplicate entity lanes stay distinct', async t => {
  const h = await controlled(
    t,
    `import {useState} from 'react';import {RecordCollection} from '../src/react/workspace/kit/RecordCollection';
const records=[{id:'r',owner:'p1'}];const fields=[{key:'owner',label:'Owner',kind:'entity',getValue:row=>row.owner,options:[{value:'p1',label:'Alex',description:'North'},{value:'p2',label:'Alex',description:'South'}]}];
export default function Fixture(){const[kind,setKind]=useState('denied');return <><button data-ready='' onClick={()=>setKind('ready')}>Ready</button><RecordCollection records={records} fields={fields} query={{search:'',filters:[],sort:[]}} onQueryChange={()=>{}} projection={['owner']} onProjectionChange={()=>{}} activeId={null} onActiveIdChange={()=>{}} checkedIds={[]} onCheckedIdsChange={()=>{}} state={{kind}} view='board' boardFieldKey='owner' bulkActions={<button data-bulk=''>Apply bulk</button>}/></>}`,
    {},
  );
  assert.equal(h.document.querySelector('[data-bulk]'), null);
  await h.click(h.document.querySelector('[data-ready]'));
  assert.ok(h.document.querySelector('[data-bulk]'));
  const headings = [...h.document.querySelectorAll('.kit-board h4')].map(node => node.textContent);
  assert.ok(headings.some(text => text.includes('Alex — North · p1')));
  assert.ok(headings.some(text => text.includes('Alex — South · p2')));
});
