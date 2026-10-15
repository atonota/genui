import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { buttonByText, mountPattern } from './harness.mjs';

async function mountFixture(t, body) {
  const file = `docs/tests/.accessibility-workspace-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import {RecordForm} from '../src/react/workspace/kit/RecordForm';
import {EditableGrid} from '../src/react/workspace/kit/EditableGrid';
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

const fields = [
  {
    key: 'title',
    label: 'Title',
    kind: 'text',
    required: true,
    getValue: record => record.title,
    setValue: (record, value) => ({ ...record, title: value }),
  },
  {
    key: 'location',
    label: 'Location',
    kind: 'text',
    required: true,
    getValue: record => record.location,
    setValue: (record, value) => ({ ...record, location: value }),
  },
];

test(
  'invalid saved-view JSON associates its error with the textarea and clears the association on export',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern(
      'SavedViewSettings',
      'docs/src/react/workspace/kit/CollectionTools.tsx',
      {
        fields,
        settings: {
          query: { search: '', filters: [], sort: [] },
          projection: ['title'],
          group: { fieldKey: null, activeGroupId: null },
          view: 'table',
        },
        onLoad: () => assert.fail('invalid JSON must not load settings'),
      },
    );
    t.after(() => h.dispose());
    const input = h.document.querySelector('.kit-saved-views textarea');
    await h.type(input, '{');
    await h.click(buttonByText(h.document, 'Validate and load settings'));

    assert.equal(input.getAttribute('aria-invalid'), 'true');
    const error = h.document.querySelector('.kit-saved-views [role="alert"]');
    assert.ok(error?.id, 'the displayed validation error needs a stable target ID');
    assert.ok(
      input.getAttribute('aria-describedby')?.split(/\s+/).includes(error.id),
      'refocusing the invalid textarea must expose its displayed error',
    );

    await h.click(buttonByText(h.document, 'Export current settings'));
    assert.equal(input.getAttribute('aria-invalid'), 'false');
    assert.equal(input.getAttribute('aria-describedby'), null);
    assert.ok(h.document.querySelector('.kit-saved-views [role="alert"]') === null);
  },
);

test(
  'unknown form-level errors remain readable without offering a dead go-to action',
  { timeout: 5000 },
  async t => {
    const h = await mountFixture(
      t,
      `
const record={id:'record-a',title:'Authored title'};
const fields=[{key:'title',label:'Title',kind:'text',required:true,getValue:r=>r.title,setValue:(r,value)=>({...r,title:value})}];
export default function Fixture(){const[draft,setDraft]=useState(record);const[commits,setCommits]=useState(0);return <AtlasProvider><RecordForm record={record} draft={draft} fields={fields} errors={{_server:'The supplied operation could not be completed.'}} onDraftChange={setDraft} onCommit={()=>setCommits(value=>value+1)} onCancel={()=>setDraft(record)}/><output>{commits}</output></AtlasProvider>}`,
    );
    await h.submit(h.document.querySelector('form'));

    const summary = h.document.querySelector('.kit-error-summary');
    assert.equal(summary.getAttribute('role'), 'alert');
    assert.match(summary.textContent, /The supplied operation could not be completed/);
    assert.ok(
      h.document.activeElement === summary,
      'a form-level failure focuses its mounted summary',
    );
    assert.equal(h.document.querySelector('output').textContent, '0');
    assert.ok(
      summary.querySelector('button') === null,
      'a form-level message without a field target must not promise field navigation',
    );
  },
);

test(
  'draft identity errors remain visible and focused until the supplied identity is restored',
  { timeout: 5000 },
  async t => {
    const h = await mountFixture(
      t,
      `
const record={id:'record-a',title:'Authored title'};
const fields=[{key:'title',label:'Title',kind:'text',required:true,getValue:r=>r.title,setValue:(r,value)=>({...r,title:value})}];
export default function Fixture(){const[draft,setDraft]=useState({...record,id:'wrong-record'});const[commits,setCommits]=useState(0);return <AtlasProvider><button data-restore-identity='' onClick={()=>setDraft(current=>({...current,id:record.id}))}>Restore supplied identity</button><RecordForm record={record} draft={draft} fields={fields} errors={{}} onDraftChange={setDraft} onCommit={()=>setCommits(value=>value+1)} onCancel={()=>setDraft(record)}/><output>{commits}</output></AtlasProvider>}`,
    );
    await h.submit(h.document.querySelector('form'));

    const summary = h.document.querySelector('.kit-error-summary');
    assert.ok(summary, 'a rejected identity change must render its form-level error');
    assert.match(summary.textContent, /The draft record identity cannot change/);
    assert.ok(h.document.activeElement === summary, 'identity rejection focuses its summary');
    assert.ok(
      summary.querySelector('button') === null,
      'identity errors have no field destination',
    );
    assert.equal(h.document.querySelector('output').textContent, '0');

    await h.click(h.document.querySelector('[data-restore-identity]'));
    assert.ok(
      h.document.querySelector('.kit-error-summary') === null,
      'correcting identity clears its derived error',
    );
    await h.submit(h.document.querySelector('form'));
    assert.equal(h.document.querySelector('output').textContent, '1');
  },
);

test(
  'failed grid commits announce and focus a summary for projected-out errors on another page',
  { timeout: 5000 },
  async t => {
    const h = await mountFixture(
      t,
      `
const records=[{id:'first',title:'First record',location:'North'},{id:'second',title:'Second record',location:'South'}];
const fields=['title','location'].map(key=>({key,label:key==='title'?'Title':'Location',kind:'text',required:true,getValue:r=>r[key],setValue:(r,value)=>({...r,[key]:value})}));
export default function Fixture(){const[drafts,setDrafts]=useState({second:{...records[1],title:'Changed title',location:''}});const[commits,setCommits]=useState(0);return <AtlasProvider><EditableGrid records={records} fields={fields} drafts={drafts} projection={['title']} pageSize={1} onDraftsChange={setDrafts} onCommit={()=>setCommits(value=>value+1)} onCancel={()=>setDrafts({})}/><output>{commits}</output></AtlasProvider>}`,
    );
    assert.ok(h.document.querySelector('[data-grid-row="second"]') === null);
    await h.click(buttonByText(h.document, 'Commit all drafts'));

    const summary = h.document.querySelector('.kit-grid-error-summary');
    assert.equal(summary.getAttribute('role'), 'alert');
    assert.equal(summary.getAttribute('tabindex'), '-1');
    assert.ok(h.document.activeElement === summary, 'failed commit focuses its error summary');
    assert.match(summary.textContent, /second.*Location.*required/s);
    assert.equal(h.document.querySelector('output').textContent, '0');

    const commit = buttonByText(h.document, 'Commit all drafts');
    await h.act(async () => commit.focus());
    await h.click(commit);
    assert.ok(
      h.document.activeElement === summary,
      'a repeated failed commit refocuses the existing summary',
    );

    await h.click(buttonByText(summary, 'Show Location for second'));
    const target = buttonByText(h.document, 'Edit Location for second');
    assert.ok(target, 'error navigation reveals the missing column and correct page');
    assert.ok(
      h.document.activeElement === target,
      'error navigation focuses the revealed field action',
    );
  },
);
