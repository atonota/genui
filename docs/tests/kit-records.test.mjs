import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';

async function mountFixture(t, body) {
  const file = `docs/tests/.kit-records-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {useState,useRef} from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport {RecordForm} from '../src/react/workspace/kit/RecordForm';\nimport {RecordDisplay} from '../src/react/workspace/kit/RecordDisplay';\nimport {RecordPanel} from '../src/react/workspace/kit/RecordPanel';\nimport {EntityPicker} from '../src/react/workspace/kit/EntityPicker';\nimport {RepeatingRecordEditor} from '../src/react/workspace/kit/RepeatingRecordEditor';\nimport {ReviewQueue,ChangeReview,CopyCreate} from '../src/react/workspace/kit/ActionReview';\nimport {AttachmentList,AttachmentPreview,EventList,AuditDisplay,RecordDiff} from '../src/react/workspace/kit/EvidencePanels';\n${body}`,
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

test('RecordForm reveals a hidden invalid field without losing the mounted draft', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'name',label:'Customer name',kind:'text',section:'Identity',required:true,getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})},{key:'email',label:'Contact email',kind:'text',section:'Contact',required:true,getValue:r=>r.email,setValue:(r,v)=>({...r,email:v})}];
    export default function Fixture(){const record={id:'R-1',name:'',email:''};const[draft,setDraft]=useState(record);const[committed,setCommitted]=useState('');return <GenUXProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}} organization="steps" onDraftChange={setDraft} onCommit={r=>setCommitted(r.name)} onCancel={()=>{}}/><output data-committed="">{committed}</output></GenUXProvider>}
  `,
  );
  const name = h.document.querySelector('[data-field-key="name"] input');
  const email = h.document.querySelector('[data-field-key="email"] input');
  assert.ok(name && email, 'all section fields are mounted once');
  await h.type(name, 'Unsaved customer');
  assert.equal(
    h.document.querySelector('[data-committed]').textContent,
    '',
    'editing is not commit',
  );
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-field-key="name"] input'), name);
  assert.equal(name.value, 'Unsaved customer');
  assert.equal(
    h.document.activeElement,
    email,
    'hidden invalid field becomes reachable and focused',
  );
  assert.match(h.document.body.textContent, /Contact email/);
  await h.type(email, 'reader@example.test');
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-committed]').textContent, 'Unsaved customer');
});

test('EntityPicker stores disambiguated IDs and open/create remain explicit intents', async t => {
  const h = await mountFixture(
    t,
    `
    export default function Fixture(){const[value,setValue]=useState('north');const[opened,setOpened]=useState('');const[created,setCreated]=useState(false);return <GenUXProvider><EntityPicker id="entity-test" label="Customer relation" value={value} options={[{id:'north',label:'Acme'},{id:'south',label:'Acme'}]} onChange={setValue} onOpen={setOpened} onCreate={()=>setCreated(true)}/><output data-value="">{value}</output><output data-opened="">{opened}</output><output data-created="">{String(created)}</output></GenUXProvider>}
  `,
  );
  await selectOption(h, h.document.querySelector('#entity-test'), 'Acme · south');
  assert.equal(h.document.querySelector('[data-value]').textContent, 'south');
  await h.click(buttonByText(h.document, 'Open related record'));
  assert.equal(h.document.querySelector('[data-opened]').textContent, 'south');
  await h.click(buttonByText(h.document, 'Create related record'));
  assert.equal(h.document.querySelector('[data-created]').textContent, 'true');
});

test('RepeatingRecordEditor preserves child/error identity through reorder and remove', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'label',label:'Line description',kind:'text',getValue:r=>r.label,setValue:(r,v)=>({...r,label:v})}];
    export default function Fixture(){const[rows,setRows]=useState([{id:'first',label:'First draft'},{id:'second',label:'Second draft'}]);return <GenUXProvider><RepeatingRecordEditor rows={rows} fields={fields} errorsById={{first:{label:'Review first line'}}} onRowsChange={setRows} createRow={()=>({id:'third',label:''})}/></GenUXProvider>}
  `,
  );
  const first = h.document.querySelector('[data-child-id="first"] input');
  await h.type(first, 'Authored first');
  await h.click(buttonByText(h.document, 'Move first down'));
  assert.equal(h.document.querySelector('[data-child-id="first"] input'), first);
  assert.equal(first.value, 'Authored first');
  assert.match(
    h.document.querySelector('[data-child-id="first"]').textContent,
    /Review first line/,
  );
  assert.equal(h.document.querySelector('[data-child-id]').dataset.childId, 'second');
  const remove = buttonByText(h.document, 'Remove first');
  await h.act(async () => remove.focus());
  await h.click(remove);
  assert.ok(
    h.document.activeElement.closest('[data-child-id="second"]'),
    'removed child returns focus to remaining row',
  );
});

test('ReviewQueue navigation cannot approve and reports distinct queue counters', async t => {
  const h = await mountFixture(
    t,
    `
    export default function Fixture(){const[active,setActive]=useState('a');const[decision,setDecision]=useState('');return <GenUXProvider><ReviewQueue items={[{id:'a',label:'Alpha'},{id:'b',label:'Beta'}]} activeId={active} completedIds={['done']} deferredIds={['later']} onNavigate={setActive} onDecision={(id,action)=>setDecision(id+':'+action)}/><output data-decision="">{decision}</output><output data-active="">{active}</output></GenUXProvider>}
  `,
  );
  await h.click(buttonByText(h.document, 'Next queued record'));
  assert.equal(h.document.querySelector('[data-active]').textContent, 'b');
  assert.equal(h.document.querySelector('[data-decision]').textContent, '');
  await h.click(buttonByText(h.document, 'Approve record'));
  assert.equal(h.document.querySelector('[data-decision]').textContent, 'b:approve');
  assert.match(h.document.body.textContent, /Completed: 1/);
  assert.match(h.document.body.textContent, /Deferred: 1/);
});

test('ChangeReview shows supplied unknown/partial results without claiming success', async t => {
  const h = await mountFixture(
    t,
    `
    export default function Fixture(){return <GenUXProvider><ChangeReview targets={[{id:'a',changes:[{fieldKey:'owner',label:'Owner',mode:'set',before:'Old',after:'New'}]},{id:'b',changes:[{fieldKey:'owner',label:'Owner',mode:'clear',before:'Other',after:null}]}]} results={[{id:'a',state:'partial',message:'One field accepted',retryable:true},{id:'b',state:'unknown',message:'Outcome unconfirmed'}]}/></GenUXProvider>}
  `,
  );
  assert.match(h.document.body.textContent, /Partial result/);
  assert.match(h.document.body.textContent, /Unknown outcome/);
  assert.match(h.document.body.textContent, /Outcome unconfirmed/);
  assert.equal(buttonByText(h.document, 'Apply prepared changes'), undefined);
});

test('RecordDisplay null record exposes recovery state without edit intent', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){return <GenUXProvider><RecordDisplay record={null} recordId="missing-id" fields={[]} state={{kind:'not-found',message:'Record was removed'}} onEdit={()=>{}}/></GenUXProvider>}`,
  );
  assert.match(h.document.body.textContent, /Record was removed/);
  assert.equal(buttonByText(h.document, 'Edit record'), undefined);
});

test('RecordForm never evaluates a restricted getter or an unknown-operation commit', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'public',label:'Public value',kind:'text',getValue:r=>r.public,setValue:(r,v)=>({...r,public:v})},{key:'secret',label:'Restricted field',kind:'text',availability:()=>({state:'restricted',reason:'Supplied restriction'}),getValue:()=>{throw new Error('Restricted getter must not run')},setValue:r=>r}];
    export default function Fixture(){const record={id:'r',public:'Visible'};const[draft,setDraft]=useState(record);const[committed,setCommitted]=useState(false);return <GenUXProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}} operation={{kind:'unknown',message:'Outcome unconfirmed'}} onDraftChange={setDraft} onCommit={()=>setCommitted(true)} onCancel={()=>{}}/><output data-committed="">{String(committed)}</output></GenUXProvider>}
  `,
  );
  assert.match(h.document.body.textContent, /Supplied restriction/);
  assert.match(h.document.body.textContent, /Outcome unconfirmed/);
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-committed]').textContent, 'false');
});

test('CopyCreate refuses the source identity and leaves identity assignment to the caller', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];
    export default function Fixture(){const source={id:'same',name:'Source name'};const[candidate,setCandidate]=useState({...source});const[created,setCreated]=useState('');return <GenUXProvider><CopyCreate source={source} candidate={candidate} fields={fields} onCandidateChange={setCandidate} onCreate={value=>setCreated(value.id)} onCancel={()=>{}}/><output data-created="">{created}</output></GenUXProvider>}
  `,
  );
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-created]').textContent, '');
  assert.match(h.document.body.textContent, /distinct caller-supplied ID/);
});

test('Form tabs and accordion headers preserve one mounted field tree', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'name',label:'Name',kind:'text',section:'Identity',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})},{key:'note',label:'Note',kind:'multiline',section:'Context',getValue:r=>r.note,setValue:(r,v)=>({...r,note:v})}];
    export default function Fixture(){const record={id:'r',name:'Initial',note:'Note'};const[draft,setDraft]=useState(record);const[organization,setOrganization]=useState('tabs');return <GenUXProvider><button data-use-accordion="" onClick={()=>setOrganization('accordion')}>Use accordion</button><RecordForm record={record} draft={draft} fields={fields} errors={{}} organization={organization} onDraftChange={setDraft} onCommit={()=>{}} onCancel={()=>{}}/></GenUXProvider>}
  `,
  );
  const name = h.document.querySelector('[data-field-key="name"] input');
  assert.equal(h.document.querySelectorAll('[role="tab"]').length, 2);
  await h.type(name, 'Preserved value');
  await h.click(h.document.querySelector('[data-use-accordion]'));
  assert.equal(h.document.querySelector('[data-field-key="name"] input'), name);
  const header = [...h.document.querySelectorAll('button[aria-expanded]')].find(button =>
    button.textContent.startsWith('Identity'),
  );
  assert.ok(header);
  await h.click(header);
  assert.equal(
    h.document.getElementById(header.getAttribute('aria-controls')).getAttribute('aria-hidden'),
    'true',
  );
  await h.click(header);
  assert.equal(h.document.querySelector('[data-field-key="name"] input'), name);
  assert.equal(name.value, 'Preserved value');
});

test('Repeating row operation state blocks only its target and preserves supplied results', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'label',label:'Line label',kind:'text',getValue:r=>r.label,setValue:(r,v)=>({...r,label:v})}];
    export default function Fixture(){const[rows,setRows]=useState([{id:'first',label:'First'},{id:'second',label:'Second'}]);return <GenUXProvider><RepeatingRecordEditor rows={rows} fields={fields} operationsById={{first:{kind:'pending',message:'Waiting for the first supplied result'}}} onRowsChange={setRows}/><output data-row-count="">{rows.length}</output></GenUXProvider>}
  `,
  );
  assert.equal(buttonByText(h.document, 'Remove first').disabled, true);
  await h.click(buttonByText(h.document, 'Remove first'));
  assert.equal(h.document.querySelector('[data-row-count]').textContent, '2');
  const second = h.document.querySelector('[data-child-id="second"] input');
  await h.type(second, 'Second remains editable');
  assert.equal(second.value, 'Second remains editable');
  assert.match(
    h.document.querySelector('[data-child-id="first"]').textContent,
    /Waiting for the first supplied result/,
  );
});

test('RecordDisplay reports controlled section and return-context intents', async t => {
  const h = await mountFixture(
    t,
    `
    const fields=[{key:'name',label:'Name',kind:'text',section:'Identity',getValue:r=>r.name},{key:'note',label:'Note',kind:'text',section:'Context',getValue:r=>r.note}];
    export default function Fixture(){const[active,setActive]=useState('Identity');const[returned,setReturned]=useState(false);return <GenUXProvider><RecordDisplay record={{id:'r',name:'Record',note:'Context note'}} fields={fields} presentation="tabs" activeSection={active} onSectionChange={setActive} returnContext={{label:'Results',onReturn:()=>setReturned(true)}}/><output data-active-section="">{active}</output><output data-returned="">{String(returned)}</output></GenUXProvider>}
  `,
  );
  await h.click(
    [...h.document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Context'),
  );
  assert.equal(h.document.querySelector('[data-active-section]').textContent, 'Context');
  const selected = h.document.querySelector('[role="tab"][aria-selected="true"]');
  assert.equal(selected.textContent, 'Context');
  await h.click(buttonByText(h.document, 'Back to Results'));
  assert.equal(h.document.querySelector('[data-returned]').textContent, 'true');
});

test('Evidence panels gate blocked states and retain only explicitly partial or stale supplied content', async t => {
  const h = await mountFixture(
    t,
    `
    const attachment={id:'secret-attachment',name:'Private attachment name',mimeType:'application/private',sizeBytes:12,preview:{kind:'text',text:'Private attachment content'}};
    const event={id:'secret-event',at:'2026-10-13T09:00:00Z',actor:'Private actor',title:'Private event title',detail:'Private event detail'};
    const differences=[{key:'secret',label:'Private field',before:'Private before',after:'Private after'}];
    export default function Fixture(){const[kind,setKind]=useState('ready');return <GenUXProvider><nav>{['denied','unknown','loading','error','not-found','partial','stale'].map(value=><button key={value} data-evidence-state={value} onClick={()=>setKind(value)}>{value}</button>)}</nav><AttachmentList attachments={[attachment]} selectedId={attachment.id} onSelect={()=>{}} state={{kind}}/><AttachmentPreview attachment={attachment} state={{kind}}/><EventList events={[event]} state={{kind}}/><AuditDisplay events={[event]} state={{kind}}/><RecordDiff differences={differences} state={{kind}}/></GenUXProvider>}
  `,
  );
  assert.match(h.document.body.textContent, /Private attachment name/);
  for (const kind of ['denied', 'unknown', 'loading', 'error', 'not-found']) {
    await h.click(h.document.querySelector(`[data-evidence-state="${kind}"]`));
    assert.doesNotMatch(
      h.document.body.textContent,
      /Private attachment name|Private attachment content|Private actor|Private event title|Private event detail|Private before|Private after/,
    );
    assert.equal(buttonByText(h.document, 'Private attachment name'), undefined);
  }
  for (const kind of ['partial', 'stale']) {
    await h.click(h.document.querySelector(`[data-evidence-state="${kind}"]`));
    assert.match(h.document.body.textContent, /Private attachment name/);
    assert.match(h.document.body.textContent, /Private actor/);
    assert.match(h.document.body.textContent, /Private before/);
    assert.match(h.document.body.textContent, /Private attachment content/);
  }
});

test('Evidence panels preserve supplied strings when Turkish UI labels are translated', async t => {
  const h = await mountFixture(
    t,
    `export default function Fixture(){return <GenUXProvider><RecordDiff differences={[{key:'first',label:'First',before:'Not set',after:'Yes'},{key:'second',label:'Second',before:'No',after:null},{key:'third',label:'Third',before:false,after:true}]}/><EventList events={[{id:'event',at:'2026-10-13T09:00:00Z',actor:'Not set',title:'Yes',detail:'No'}]}/></GenUXProvider>}`,
  );
  await h.act(async () => h.setLocale('tr'));
  const cells = [...h.document.querySelectorAll('.kit-record-diff tbody td')].map(
    cell => cell.textContent,
  );
  assert.deepEqual(cells, ['Not set', 'Yes', 'No', 'Belirtilmedi', 'Hayır', 'Evet']);
  assert.equal(h.document.querySelector('.kit-event h4').textContent, 'Yes');
  assert.equal(h.document.querySelectorAll('.kit-event p')[1].textContent, 'No');
});

const panelFixture = `
  const records=[{id:'note-a',title:'Alpha notebook',notes:'Long supplied note. '.repeat(100)},{id:'note-b',title:'Beta notebook',notes:'Second supplied note. '.repeat(100)}];
  const fields=[{key:'title',label:'Notebook title',kind:'text',section:'Identity',getValue:r=>r.title},{key:'notes',label:'Notebook notes',kind:'multiline',section:'Context',getValue:r=>r.notes}];
  export default function Fixture(){const[active,setActive]=useState('note-a');const[open,setOpen]=useState(false);const[container,setContainer]=useState('inline');const[history,setHistory]=useState([]);const[draft,setDraft]=useState('Parent draft');const[denied,setDenied]=useState(false);const[editCount,setEditCount]=useState(0);const opener=useRef(null);return <GenUXProvider><button ref={opener} data-panel-open="" onClick={()=>setOpen(true)}>Open current panel</button><nav>{['page','inline','split','modal','drawer'].map(value=><button key={value} data-panel-mode={value} onClick={()=>setContainer(value)}>{value}</button>)}</nav><button data-deny="" onClick={()=>setDenied(true)}>Deny supplied content</button><input data-parent-draft="" value={draft} onChange={event=>setDraft(event.target.value)}/><output data-active-id="">{active}</output><output data-edit-count="">{editCount}</output><RecordPanel record={records.find(record=>record.id===active)} fields={fields} open={open} onClose={()=>setOpen(false)} container={container} returnFocusRef={opener} capability={{allowed:false,reason:'Editing is unavailable'}} onEdit={()=>setEditCount(value=>value+1)} state={{kind:denied?'denied':'ready'}} returnTrail={history.map((recordId,index)=>({id:recordId+'::'+index,label:recordId+' visit '+index,onReturn:()=>{setActive(recordId);setHistory(current=>current.slice(0,index))}}))}><button data-related="" onClick={()=>{setHistory(current=>[...current,active]);setActive(active==='note-a'?'note-b':'note-a')}}>Open related notebook</button><p data-panel-end="">End of notebook content</p></RecordPanel></GenUXProvider>}
`;

test('RecordPanel preserves generic record context through containers and native close/reopen', async t => {
  const h = await mountFixture(t, panelFixture);
  const opener = h.document.querySelector('[data-panel-open]');
  const draft = h.document.querySelector('[data-parent-draft]');
  await h.type(draft, 'Caller-owned unsaved draft');
  await h.act(async () => opener.focus());
  await h.click(opener);
  await h.click(h.document.querySelector('[data-related]'));
  assert.equal(h.document.querySelector('[data-panel-record]').dataset.panelRecord, 'note-b');
  for (const container of ['page', 'split', 'modal', 'drawer', 'inline']) {
    await h.click(h.document.querySelector(`[data-panel-mode="${container}"]`));
    await h.waitFor(
      () =>
        h.document.querySelector('[data-panel-record]')?.dataset.panelRecord === 'note-b' &&
        h.document.querySelector('[data-panel-shell]')?.dataset.panelShell === container,
      'same generic record in ' + container,
    );
    if (container === 'modal' || container === 'drawer')
      assert.equal(h.document.querySelectorAll('[role="dialog"]').length, 1, 'one native dialog');
    assert.equal(h.document.querySelector('[data-parent-draft]'), draft);
    assert.equal(draft.value, 'Caller-owned unsaved draft');
  }
  await h.click(buttonByText(h.document, 'Close record'));
  assert.equal(
    h.document.querySelector('[data-panel-container="inline"]').getAttribute('aria-hidden'),
    'true',
  );
  assert.equal(h.document.activeElement, opener);
  await h.click(opener);
  assert.equal(h.document.querySelector('[data-panel-record]').dataset.panelRecord, 'note-b');
});

test('RecordPanel relation return visits are explicit and denied state gates supplied content', async t => {
  const h = await mountFixture(t, panelFixture);
  await h.click(h.document.querySelector('[data-panel-open]'));
  const edit = buttonByText(h.document, 'Edit record');
  assert.equal(edit.disabled, true);
  await h.click(edit);
  assert.equal(h.document.querySelector('[data-edit-count]').textContent, '0');
  for (let n = 0; n < 3; n++) await h.click(h.document.querySelector('[data-related]'));
  const trail = h.document.querySelector('[aria-label="Record return trail"]');
  assert.equal(trail.querySelectorAll('li').length, 3);
  await h.click(buttonByText(trail, 'Return to note-a visit 2'));
  assert.equal(h.document.querySelector('[data-active-id]').textContent, 'note-a');
  assert.equal(
    h.document.querySelector('[aria-label="Record return trail"]').querySelectorAll('li').length,
    2,
  );
  await h.click(h.document.querySelector('[data-deny]'));
  assert.doesNotMatch(
    h.document.body.textContent,
    /Alpha notebook|Beta notebook|Long supplied note|Second supplied note/,
  );
  assert.equal(h.document.querySelector('[data-related]'), null);
  assert.equal(h.document.querySelector('[aria-label="Record return trail"]'), null);
});

test('RecordPanel rapid overlay container reversal never remains in its closing state', async t => {
  const h = await mountFixture(t, panelFixture);
  await h.click(h.document.querySelector('[data-panel-mode="modal"]'));
  await h.click(h.document.querySelector('[data-panel-open]'));
  await h.waitFor(() => h.document.querySelector('[role="dialog"]'), 'modal opened');
  await h.act(() => h.document.querySelector('[data-panel-mode="inline"]').click());
  await h.act(() => h.document.querySelector('[data-panel-mode="modal"]').click());
  await h.waitFor(
    () =>
      h.document.querySelector('.ant-modal-wrap')?.style.display !== 'none' &&
      h.document.querySelector('[role="dialog"]'),
    'reversed modal is open',
  );
  await h.click(h.document.querySelector('.ant-modal-wrap button[aria-label="Close record"]'));
  await h.waitFor(
    () => h.document.querySelector('.ant-modal-wrap')?.style.display === 'none',
    'modal closes after reversal while preserving its section state',
  );
  await h.click(h.document.querySelector('[data-panel-open]'));
  await h.waitFor(
    () =>
      h.document.querySelectorAll('[role="dialog"]').length === 1 &&
      h.document.querySelector('.ant-modal-wrap')?.style.display !== 'none',
    'the single retained modal can reopen after reversal',
  );
});
