import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { buttonByText, mountPattern } from './harness.mjs';

async function mountFixture(t, body) {
  const file = `docs/tests/.pagination-workspace-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import RecordCollection from '../src/react/workspace/kit/RecordCollection';
import EditableGrid from '../src/react/workspace/kit/EditableGrid';
const records=Array.from({length:23},(_,index)=>({id:'record-'+(index+1),title:'Record '+String(index+1).padStart(2,'0'),amount:index+1,group:index<12?'included':'other'}));
const fields=[{key:'title',label:'Title',kind:'text',required:true,getValue:record=>record.title,setValue:(record,value)=>({...record,title:value})},{key:'amount',label:'Amount',kind:'number',precision:2,getValue:record=>record.amount,setValue:(record,value)=>({...record,amount:value})}];
const collection={records,fields,projection:['title'],pageSize:2,checkedIds:[],activeId:null,onCheckedIdsChange:()=>{},onActiveIdChange:()=>{},onProjectionChange:()=>{}};
${body}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  return h;
}

function pagination(h, label) {
  const matches = h.document.querySelectorAll(`nav[aria-label="${label}"]`);
  assert.equal(matches.length, 1, 'each consumer has one pagination control');
  return matches[0];
}

function named(scope, label) {
  const control = scope.querySelector(`button[aria-label="${label}"]`);
  assert.ok(control, `${label} must be available`);
  return control;
}

function currentPage(scope) {
  return Number(scope.querySelector('[aria-current="page"]')?.textContent.trim());
}

function firstCollectionId(h) {
  return h.document.querySelector('.kit-table tbody th[scope="row"]')?.textContent.trim();
}

test('controlled collection exposes end and near-end destinations and updates its host once', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[query,setQuery]=useState({search:'',filters:[],sort:[]});const[page,setPage]=useState(6);const[changes,setChanges]=useState([]);return <AtlasProvider><RecordCollection {...collection} query={query} onQueryChange={setQuery} page={page} onPageChange={value=>{setChanges(previous=>[...previous,value]);setPage(value)}}/><output data-page-changes="">{JSON.stringify(changes)}</output></AtlasProvider>}`,
  );
  const nav = () => pagination(h, 'Collection pages');
  named(nav(), 'First page');
  named(nav(), 'Last page');
  assert.ok(buttonByText(nav(), '2'), 'the second page remains directly available');
  assert.ok(buttonByText(nav(), '11'), 'the penultimate page remains directly available');
  assert.equal(
    nav().querySelector('.ant-select'),
    null,
    'the consumer retains page-size ownership',
  );

  await h.click(buttonByText(nav(), '11'));
  assert.equal(currentPage(nav()), 11);
  assert.equal(firstCollectionId(h), 'record-21');
  assert.equal(h.document.querySelector('[data-page-changes]').textContent, '[11]');
  await h.click(buttonByText(nav(), '2'));
  assert.equal(currentPage(nav()), 2);
  assert.equal(firstCollectionId(h), 'record-3');
  assert.equal(h.document.querySelector('[data-page-changes]').textContent, '[11,2]');

  await h.click(named(nav(), 'Last page'));
  assert.equal(currentPage(nav()), 12);
  assert.equal(firstCollectionId(h), 'record-23');
  assert.equal(h.document.querySelector('[data-page-changes]').textContent, '[11,2,12]');
  await h.click(named(nav(), 'First page'));
  assert.equal(currentPage(nav()), 1);
  assert.equal(h.document.querySelector('[data-page-changes]').textContent, '[11,2,12,1]');
  const jump = nav().querySelector('input[aria-label="Go to page"]');
  assert.ok(jump, 'arbitrary pages remain reachable through the quick jumper');
  await h.type(jump, '8');
  await h.act(async () => {
    jump.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  assert.equal(currentPage(nav()), 8);
  assert.equal(firstCollectionId(h), 'record-15');
  assert.equal(h.document.querySelector('[data-page-changes]').textContent, '[11,2,12,1,8]');
});

test('uncontrolled collection resets pages for query and group changes and uses the scoped total', async t => {
  const h = await mountFixture(
    t,
    `const groups=[{id:'included',label:'Included',kind:'exclusive',matches:record=>record.group==='included'}];export default function Fixture(){const[query,setQuery]=useState({search:'',filters:[],sort:[]});return <AtlasProvider><RecordCollection {...collection} groups={groups} query={query} onQueryChange={setQuery}/></AtlasProvider>}`,
  );
  const nav = () => pagination(h, 'Collection pages');
  await h.click(named(nav(), 'Last page'));
  assert.equal(firstCollectionId(h), 'record-23');
  const search = h.document.querySelector('.kit-query-bar input');
  await h.type(search, 'Record 0');
  assert.equal(currentPage(nav()), 1);
  assert.equal(firstCollectionId(h), 'record-1');
  await h.click(named(nav(), 'Last page'));
  assert.equal(currentPage(nav()), 5, 'nine matching records produce five pages');
  assert.equal(firstCollectionId(h), 'record-9');

  await h.type(search, '');
  await h.click(named(nav(), 'Last page'));
  await h.click(buttonByText(h.document.querySelector('.kit-group-nav'), 'Included (12)'));
  assert.equal(currentPage(nav()), 1);
  await h.click(named(nav(), 'Last page'));
  assert.equal(currentPage(nav()), 6, 'group pagination counts only its twelve scoped records');
  assert.equal(firstCollectionId(h), 'record-11');
});

test('editable grid closes an editor on direct page changes while retaining valid drafts', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[drafts,setDrafts]=useState({});return <AtlasProvider><EditableGrid records={records} fields={fields} pageSize={2} drafts={drafts} onDraftsChange={setDrafts} onCommit={()=>{}} onCancel={()=>{}}/><output data-drafts="">{JSON.stringify(drafts)}</output></AtlasProvider>}`,
  );
  const nav = () => pagination(h, 'Editable grid pages');
  await h.click(h.document.querySelector('[data-edit-trigger="record-1::title"]'));
  await h.type(h.document.querySelector('[data-editing-cell="true"] input'), 'Retained page draft');
  await h.click(named(nav(), 'Last page'));
  assert.equal(currentPage(nav()), 12);
  assert.equal(h.document.querySelector('[data-editing-cell="true"]'), null);
  assert.ok(h.document.querySelector('[data-grid-row="record-23"]'));
  assert.equal(
    JSON.parse(h.document.querySelector('[data-drafts]').textContent)['record-1'].title,
    'Retained page draft',
  );
  await h.click(named(nav(), 'First page'));
  assert.match(
    h.document.querySelector('[data-grid-row="record-1"]').textContent,
    /Retained page draft/,
  );
  assert.equal(nav().querySelector('.ant-select'), null);
});

test('editable grid disables every destination while a raw numeric input is invalid or an operation is blocked', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[drafts,setDrafts]=useState({});const[operation,setOperation]=useState({kind:'idle'});return <AtlasProvider><button data-operation="pending" onClick={()=>setOperation({kind:'pending'})}>Pending</button><button data-operation="unknown" onClick={()=>setOperation({kind:'unknown'})}>Unknown</button><button data-operation="idle" onClick={()=>setOperation({kind:'idle'})}>Idle</button><EditableGrid records={records} fields={fields} pageSize={2} drafts={drafts} onDraftsChange={setDrafts} onCommit={()=>{}} onCancel={()=>{}} operation={operation}/></AtlasProvider>}`,
  );
  const nav = () => pagination(h, 'Editable grid pages');
  const assertBlocked = () => {
    assert.equal(named(nav(), 'Last page').disabled, true);
    assert.ok([...nav().querySelectorAll('button,input')].every(control => control.disabled));
    assert.equal(currentPage(nav()), 1);
  };
  await h.click(h.document.querySelector('[data-edit-trigger="record-1::amount"]'));
  const input = h.document.querySelector('[data-editing-cell="true"] input');
  await h.type(input, '1.234');
  assert.match(h.document.body.textContent, /Correct or cancel the invalid cell/);
  assertBlocked();
  await h.click(named(nav(), 'Last page'));
  assert.ok(h.document.querySelector('[data-grid-row="record-1"]'));
  await h.act(async () => {
    input.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  assert.equal(named(nav(), 'Last page').disabled, false);

  for (const kind of ['pending', 'unknown']) {
    await h.click(h.document.querySelector(`[data-operation="${kind}"]`));
    assertBlocked();
    await h.click(named(nav(), 'Last page'));
    assert.ok(h.document.querySelector('[data-grid-row="record-1"]'));
  }
  await h.click(h.document.querySelector('[data-operation="idle"]'));
  await h.click(named(nav(), 'Last page'));
  assert.equal(currentPage(nav()), 12);
});

test('workspace pagination names follow locale changes while retaining pages and editor drafts', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[query,setQuery]=useState({search:'',filters:[],sort:[]});const[drafts,setDrafts]=useState({});return <AtlasProvider><RecordCollection {...collection} query={query} onQueryChange={setQuery}/><EditableGrid records={records} fields={fields} pageSize={2} drafts={drafts} onDraftsChange={setDrafts} onCommit={()=>{}} onCancel={()=>{}}/></AtlasProvider>}`,
  );
  const collectionNav = pagination(h, 'Collection pages');
  const gridNav = pagination(h, 'Editable grid pages');
  await h.click(buttonByText(collectionNav, '2'));
  const jump = collectionNav.querySelector('input[aria-label="Go to page"]');
  await h.type(jump, '7');
  await h.click(h.document.querySelector('[data-edit-trigger="record-1::title"]'));
  const editor = h.document.querySelector('[data-editing-cell="true"] input');
  await h.type(editor, 'Retained language draft');

  await h.act(async () => h.setLocale('tr'));
  assert.equal(pagination(h, 'Koleksiyon sayfaları'), collectionNav);
  assert.equal(pagination(h, 'Düzenlenebilir ızgara sayfaları'), gridNav);
  assert.equal(currentPage(collectionNav), 2);
  assert.equal(firstCollectionId(h), 'record-3');
  assert.equal(collectionNav.querySelector('input'), jump);
  assert.equal(jump.value, '7');
  assert.equal(h.document.querySelector('[data-editing-cell="true"] input'), editor);
  assert.equal(editor.value, 'Retained language draft');

  await h.act(async () => h.setLocale('en'));
  assert.equal(pagination(h, 'Collection pages'), collectionNav);
  assert.equal(pagination(h, 'Editable grid pages'), gridNav);
  assert.equal(currentPage(collectionNav), 2);
  assert.equal(editor.value, 'Retained language draft');
});
