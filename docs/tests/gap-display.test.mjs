import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mountPattern, buttonByText } from './harness.mjs';

async function mountFixture(t, body) {
  const file = `docs/tests/.gap-display-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useRef,useState} from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import {RecordDisplay} from '../src/react/workspace/kit/RecordDisplay';
import {RecordPanel,RecordTabs,RecordInspector} from '../src/react/workspace/kit/RecordPanel';
import {AttachmentList,RecordDiff} from '../src/react/workspace/kit/EvidencePanels';
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

test('no-match display gates getters, relation/edit intents and supplied children', async t => {
  const h = await mountFixture(
    t,
    `
const fields=[{key:'secret',label:'Secret',kind:'text',getValue:()=>{throw new Error('Unreadable getter evaluated')}}];
export default function Fixture(){return <GenUXProvider><RecordDisplay record={{id:'r'}} fields={fields} state={{kind:'no-match'}} onEdit={()=>{}}><p>Private supplied child</p></RecordDisplay></GenUXProvider>}`,
  );
  assert.equal(buttonByText(h.document, 'Edit record'), undefined);
  assert.doesNotMatch(h.document.body.textContent, /Private supplied child/);
  assert.equal(h.document.querySelector('[data-read-field]'), null);
});

test('page is one flat field list; sections and heading levels remain explicit', async t => {
  const h = await mountFixture(
    t,
    `
const fields=[{key:'name',label:'Name',kind:'text',section:'Identity',getValue:r=>r.name},{key:'note',label:'Note',kind:'text',section:'Context',getValue:r=>r.note}];
export default function Fixture(){const[presentation,setPresentation]=useState('page');return <GenUXProvider><button data-sections='' onClick={()=>setPresentation('sections')}>Sections</button><RecordDisplay record={{id:'r',name:'Alpha',note:'Context'}} fields={fields} headingLevel={2} presentation={presentation}/></GenUXProvider>}`,
  );
  assert.equal(h.document.querySelectorAll('.kit-display-fields').length, 1);
  assert.equal(h.document.querySelectorAll('.kit-form-section').length, 0);
  assert.equal(h.document.querySelector('.kit-record-heading h2')?.textContent, 'Record details');
  await h.click(h.document.querySelector('[data-sections]'));
  assert.equal(h.document.querySelectorAll('.kit-form-section').length, 2);
});

test('related record intent and blocked edit reason are readable and correctly associated', async t => {
  const h = await mountFixture(
    t,
    `
const fields=[{key:'owner',label:'Owner',kind:'entity',options:[{value:'person-1',label:'Alex Reed',description:'Support'}],getValue:r=>r.owner}];
export default function Fixture(){const[intent,setIntent]=useState(null);return <GenUXProvider><RecordDisplay record={{id:'r',owner:'person-1'}} fields={fields} capability={{allowed:false,reason:'Supplied read-only reason'}} onEdit={()=>{}} onOpenRelation={setIntent} navigation={{position:2,total:4,scopeLabel:'Filtered equipment',onPrevious:()=>{},onNext:()=>{}}}/><output data-intent=''>{JSON.stringify(intent)}</output></GenUXProvider>}`,
  );
  const edit = buttonByText(h.document, 'Edit record');
  assert.equal(edit.disabled, true);
  assert.match(
    h.document.getElementById(edit.getAttribute('aria-describedby')).textContent,
    /Supplied read-only reason/,
  );
  await h.click(h.document.querySelector('[data-open-relation="owner"]'));
  const intent = JSON.parse(h.document.querySelector('[data-intent]').textContent);
  assert.equal(intent.recordId, 'r');
  assert.equal(intent.entityId, 'person-1');
  assert.match(intent.label, /Alex Reed/);
  assert.match(h.document.body.textContent, /2 of 4/);
  assert.match(h.document.body.textContent, /Filtered equipment/);
});

test('panel render close guard preserves input until an explicit discard and uses fallback focus', async t => {
  const h = await mountFixture(
    t,
    `
export default function Fixture(){const[open,setOpen]=useState(true);const[value,setValue]=useState('Unsaved');const fallback=useRef(null);return <GenUXProvider><button ref={fallback} data-fallback=''>Return to results</button><RecordPanel record={{id:'r'}} fields={[]} open={open} container='inline' onClose={()=>setOpen(false)} closeGuard={()=>'confirm'} fallbackFocusRef={fallback} render={({requestClose})=><><input data-draft='' value={value} onChange={e=>setValue(e.target.value)}/><button data-request-close='' onClick={()=>requestClose()}>Request close</button></>}/></GenUXProvider>}`,
  );
  const input = h.document.querySelector('[data-draft]');
  await h.type(input, 'Preserved unsaved value');
  await h.click(h.document.querySelector('[data-request-close]'));
  assert.equal(h.document.querySelector('[data-draft]'), input);
  await h.click(buttonByText(h.document, 'Keep editing'));
  assert.equal(input.value, 'Preserved unsaved value');
  await h.click(h.document.querySelector('[data-request-close]'));
  await h.click(buttonByText(h.document, 'Discard and close'));
  assert.equal(
    h.document.querySelector('[data-panel-container]').getAttribute('aria-hidden'),
    'true',
  );
  assert.equal(h.document.activeElement, h.document.querySelector('[data-fallback]'));
});

test('overlay has one close action and retains uncontrolled section after close/reopen', async t => {
  const h = await mountFixture(
    t,
    `
const fields=[{key:'a',label:'First',section:'Identity',kind:'text',getValue:r=>r.a},{key:'b',label:'Second',section:'Context',kind:'text',getValue:r=>r.b}];
export default function Fixture(){const[open,setOpen]=useState(true);return <GenUXProvider><button data-reopen='' onClick={()=>setOpen(true)}>Reopen</button><RecordPanel record={{id:'r',a:'A',b:'B'}} fields={fields} presentation='tabs' open={open} container='modal' onClose={()=>setOpen(false)}/></GenUXProvider>}`,
  );
  await h.click(
    [...h.document.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'Context'),
  );
  const close = h.document.querySelectorAll('button[aria-label="Close record"]');
  assert.equal(close.length, 1);
  await h.click(close[0]);
  await h.waitFor(
    () => h.document.querySelector('.ant-modal-wrap')?.style.display === 'none',
    'closed retained overlay',
  );
  await h.click(h.document.querySelector('[data-reopen]'));
  await h.waitFor(
    () => h.document.querySelector('.ant-modal-wrap')?.style.display !== 'none',
    'reopened overlay',
  );
  assert.equal(
    h.document.querySelector('[role="tab"][aria-selected="true"]').textContent,
    'Context',
  );
});

test('record tabs retain pinned targets and expose a bounded controlled selection', async t => {
  const h = await mountFixture(
    t,
    `
export default function Fixture(){const[active,setActive]=useState('a');const[closed,setClosed]=useState('');return <GenUXProvider><RecordTabs tabs={[{id:'a',label:'Alpha',pinned:true},{id:'b',label:'Beta'}]} activeId={active} onActiveIdChange={setActive} onCloseTab={setClosed} maxTabs={2}/><RecordInspector pinned={true} onPinnedChange={()=>{}} width={400} onWidthChange={()=>{}}><p>Inspector content</p></RecordInspector><output data-closed=''>{closed}</output><output data-active=''>{active}</output></GenUXProvider>}`,
  );
  assert.equal(h.document.querySelectorAll('[role="tab"]').length, 2);
  assert.equal(buttonByText(h.document, 'Close Alpha').disabled, true);
  await h.click(buttonByText(h.document, 'Close Alpha'));
  assert.equal(h.document.querySelector('[data-closed]').textContent, '');
  await h.click(h.document.querySelector('[role="tab"][data-record-tab="b"]'));
  assert.equal(h.document.querySelector('[data-active]').textContent, 'b');
  assert.equal(h.document.querySelector('.kit-record-inspector').dataset.pinned, 'true');
});

test('attachment sizes scale with explicit binary units while raw diff strings remain raw', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){return <GenUXProvider><AttachmentList attachments={[{id:'a',name:'Notes',mimeType:'text/plain',sizeBytes:1536}]} selectedId={null} onSelect={()=>{}}/><RecordDiff differences={[{key:'raw',label:'Raw',before:'Not set',after:'Yes'}]}/></GenUXProvider>}`,
  );
  assert.match(h.document.querySelector('.kit-attachment-list').textContent, /1.5 KiB/);
  await h.act(async () => h.setLocale('tr'));
  assert.match(h.document.querySelector('.kit-attachment-list').textContent, /1,5 KiB/);
  assert.deepEqual(
    [...h.document.querySelectorAll('.kit-record-diff tbody td')].map(node => node.textContent),
    ['Not set', 'Yes'],
  );
});

test('long description values wrap only inside dd; table/model headings keep natural words', async () => {
  const css = await readFile('docs/src/styles/kit-records.css', 'utf8');
  assert.match(
    css,
    /\.kit-display-fields dd \.kit-field-value\s*\{[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.doesNotMatch(css, /\.kit-review-table[^}]*word-break:\s*break-all/s);
  assert.match(css, /\[data-panel-container='split'\]/);
});

test('typed differences retain per-side currency context and format duration without reading getters', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){return <GenUXProvider><RecordDiff differences={[{key:'amount',label:'Amount',before:12.5,after:0,metadata:{kind:'money',precision:2,currency:record=>record.currency},beforeRecord:{id:'old',currency:'USD'},afterRecord:{id:'new',currency:'EUR'}},{key:'elapsed',label:'Elapsed',before:90,after:0,metadata:{kind:'duration',unit:'min',precision:0}}]}/></GenUXProvider>}`,
  );
  const cells = [...h.document.querySelectorAll('.kit-record-diff tbody td')].map(
    node => node.textContent,
  );
  assert.match(cells[0], /\$12\.50/);
  assert.match(cells[1], /€0\.00/);
  assert.match(cells[2], /1 h.*30 min/);
  assert.match(cells[3], /0 s/);
});

test('open record identity changes are announced and focus the coherent panel heading', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[id,setId]=useState('alpha');return <GenUXProvider><button data-change-record='' onClick={()=>setId('beta')}>Inspect next</button><RecordPanel record={{id}} fields={[]} open={true} container='inline' onClose={()=>{}} headingLevel={2}/></GenUXProvider>}`,
  );
  await h.click(h.document.querySelector('[data-change-record]'));
  assert.equal(h.document.querySelector('[data-panel-record]').dataset.panelRecord, 'beta');
  assert.match(
    h.document.querySelector('[data-panel-identity]').textContent,
    /Now inspecting beta/,
  );
  assert.equal(h.document.activeElement, h.document.querySelector('h2.kit-panel-heading'));
  assert.equal(h.document.querySelectorAll('.kit-record-heading h2').length, 0, 'one shell title');
});

test('panel pager and relation navigation cannot bypass its supplied close guard', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){const[count,setCount]=useState(0);return <GenUXProvider><RecordPanel record={{id:'r',person:'p'}} fields={[{key:'person',label:'Person',kind:'entity',getValue:record=>record.person,options:[{value:'p',label:'Alex'}]}]} open={true} container='inline' onClose={()=>{}} closeGuard={()=>'block'} navigation={{position:1,total:2,scopeLabel:'All records',onNext:()=>setCount(value=>value+1)}} onOpenRelation={()=>setCount(value=>value+1)}/><output>{count}</output></GenUXProvider>}`,
  );
  await h.click(
    [...h.document.querySelectorAll('button')].find(button => button.textContent === 'Next record'),
  );
  await h.click(h.document.querySelector('[data-open-relation=person]'));
  assert.equal(h.document.querySelector('output').textContent, '0');
});
