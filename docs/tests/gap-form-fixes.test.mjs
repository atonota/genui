import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';

async function mountFixture(t, body) {
  const path = `docs/tests/.gap-forms-${randomUUID()}.tsx`;
  await writeFile(
    path,
    `import {useState} from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import {RecordForm} from '../src/react/workspace/kit/RecordForm';
import {FieldEditor,FieldValue} from '../src/react/workspace/kit/Fields';
import {EntityPicker} from '../src/react/workspace/kit/EntityPicker';
import {SourceComparedEntry,ConflictResolver,ChangeReview,ImportCorrectionQueue,CommandForm,CopyCreate} from '../src/react/workspace/kit/ActionReview';
import {RepeatingRecordEditor} from '../src/react/workspace/kit/RepeatingRecordEditor';
import {cloneRecord,recordsEqual,presentFieldValue,presentScalarValue,beginKitDraft,commitKitDraft,initialKitState} from '../src/data/workspace-kit';
${body}`,
  );
  let h;
  try {
    h = await mountPattern('default', path);
  } catch (error) {
    await unlink(path);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(path);
  });
  return h;
}

test('field presentation separates invalid data, availability, zero and translated semantic labels', async t => {
  const h = await mountFixture(
    t,
    `
  const tr=k=>({'Not set':'Ayarlanmamış','Restricted':'Kısıtlı','Invalid value':'Geçersiz değer','Yes':'Evet','In use':'Kullanımda'}[k]??k);
  let reads=0;const restricted={key:'secret',kind:'text',label:'Secret',getValue:()=>{reads++;throw Error('restricted read')},availability:()=>({state:'restricted'})};
  const record={id:'R',value:0};const field={key:'value',kind:'money',label:'Amount',getValue:r=>r.value,currency:'USD'};
  const results=[presentFieldValue(record,field,'tr',tr),presentFieldValue(record,{...field,currency:undefined},'tr',tr),presentFieldValue(record,restricted,'tr',tr),presentScalarValue('2026-02-31',{kind:'date'},{locale:'tr',translate:tr}),presentScalarValue(true,{kind:'boolean'},{translate:tr}),presentScalarValue('in-use',{kind:'choice',options:[{value:'in-use',label:'In use'}]},{translate:tr})];
  export default function Fixture(){return <output>{JSON.stringify({results,reads})}</output>}`,
  );
  const { results, reads } = JSON.parse(h.document.querySelector('output').textContent);
  assert.equal(reads, 0);
  assert.equal(results[0].state, 'value');
  assert.match(results[0].text, /0,00/);
  assert.equal(results[1].state, 'invalid');
  assert.equal(results[2].text, 'Kısıtlı');
  assert.equal(results[3].state, 'invalid');
  assert.equal(results[4].text, 'Evet');
  assert.equal(results[5].text, 'Kullanımda');
});

test('descriptor-safe drafts never invoke accessors and stale bases cannot overwrite newer records', async t => {
  const h = await mountFixture(
    t,
    `
  let reads=0;const original={id:'R',name:'base',nested:{value:1}};Object.defineProperty(original,'secret',{enumerable:true,get(){reads++;throw Error('accessor executed')}});
  const clone=cloneRecord(original);clone.nested.value=2;
  const date=new Date('2026-10-13T00:00:00Z'), regexp=/draft/gi, url=new URL('https://atlas.test/value'), bytes=new Uint8Array([1,2]);const aliases={left:date,right:date,regexp,url,bytes};const aliasClone=cloneRecord(aliases);const cycle={id:'cycle'};cycle.self=cycle;const cycleClone=cloneRecord(cycle);
  const schema={id:'test',label:'Test',fields:[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}],initialRecords:()=>[original],createRecord:id=>({id,name:''})};
  const begun=beginKitDraft(initialKitState(schema),schema,'R');const state={...begun,records:[Object.defineProperty({id:'R',name:'newer',nested:{value:1}},'secret',Object.getOwnPropertyDescriptor(original,'secret'))],draft:Object.defineProperty({id:'R',name:'draft',nested:{value:1}},'secret',Object.getOwnPropertyDescriptor(original,'secret'))};const committed=commitKitDraft(state,schema.fields);
  export default function Fixture(){return <output>{JSON.stringify({reads,originalNested:original.nested.value,cloneNested:clone.nested.value,same:recordsEqual(original,clone),message:committed.message,name:committed.records[0].name,retained:!!committed.draft,dateAlias:aliasClone.left===aliasClone.right,dateCopied:aliasClone.left!==date,aliasesEqual:recordsEqual(aliases,aliasClone),opaque:aliasClone.regexp===regexp&&aliasClone.url===url&&aliasClone.bytes===bytes,regexpWorks:aliasClone.regexp.test('draft'),urlWorks:aliasClone.url.href,bytesWork:aliasClone.bytes[1],cycleWorks:cycleClone.self===cycleClone&&recordsEqual(cycle,cycleClone)})}</output>}`,
  );
  const result = JSON.parse(h.document.querySelector('output').textContent);
  assert.equal(result.reads, 0);
  assert.equal(result.originalNested, 1);
  assert.equal(result.cloneNested, 2);
  assert.equal(result.same, false);
  assert.equal(result.name, 'newer');
  assert.equal(result.retained, true);
  assert.equal(result.dateAlias, true);
  assert.equal(result.dateCopied, true);
  assert.equal(result.aliasesEqual, true);
  assert.equal(result.opaque, true);
  assert.equal(result.regexpWorks, true);
  assert.equal(result.urlWorks, 'https://atlas.test/value');
  assert.equal(result.bytesWork, 2);
  assert.equal(result.cycleWorks, true);
  assert.match(result.message, /changed since this draft/i);
});

test('readonly fields remain labelled focusable and dirty cancellation needs an explicit discard decision', async t => {
  const h = await mountFixture(
    t,
    `
  const record={id:'R',name:'Original'};const fields=[{key:'id',label:'Record ID',kind:'text',getValue:r=>r.id},{key:'name',label:'Name',kind:'text',required:true,getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];
  export default function Fixture(){const[draft,setDraft]=useState(record);const[cancelled,setCancelled]=useState('');return <AtlasProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}} onDraftChange={setDraft} onCommit={()=>{}} onCancel={reason=>setCancelled(reason)}/><output>{cancelled}</output></AtlasProvider>}`,
  );
  const readonly = h.document.querySelector('[data-field-key="id"] [aria-readonly="true"]');
  assert.ok(readonly);
  assert.equal(readonly.querySelector('.kit-readonly-lock').getAttribute('aria-hidden'), 'true');
  assert.equal(readonly.tabIndex, 0);
  assert.equal(
    h.document.getElementById(readonly.getAttribute('aria-labelledby')).textContent,
    'Record ID',
  );
  await h.act(async () => readonly.focus());
  assert.equal(h.document.activeElement, readonly);
  const name = h.document.querySelector('[data-field-key="name"] input');
  await h.type(name, 'Changed');
  await h.click(buttonByText(h.document, 'Cancel draft'));
  assert.equal(h.document.querySelector('output').textContent, '');
  assert.ok(buttonByText(h.document, 'Keep editing'));
  await h.click(buttonByText(h.document, 'Keep editing'));
  assert.equal(name.value, 'Changed');
  await h.click(buttonByText(h.document, 'Cancel draft'));
  await h.click(buttonByText(h.document, 'Discard draft'));
  assert.equal(h.document.querySelector('output').textContent, 'explicit');
});

test('field errors are polite, summary is submit-only and unknown results block cancel and commit', async t => {
  const h = await mountFixture(
    t,
    `
  const record={id:'R',name:''};const fields=[{key:'name',label:'Name',kind:'text',required:true,getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];
  export default function Fixture(){const[draft,setDraft]=useState(record);const[unknown,setUnknown]=useState(false);return <AtlasProvider><RecordForm record={record} draft={draft} fields={fields} errors={{name:'This field is required.'}} onDraftChange={setDraft} onCommit={()=>{}} onCancel={()=>{}} operation={{kind:unknown?'unknown':'idle'}}/><button onClick={()=>setUnknown(true)}>Unknown result</button></AtlasProvider>}`,
  );
  assert.equal(h.document.querySelector('.kit-error-summary'), null);
  assert.equal(h.document.querySelector('.kit-field-error').getAttribute('aria-live'), 'polite');
  await h.submit(h.document.querySelector('form'));
  assert.ok(h.document.querySelector('.kit-error-summary'));
  await h.click(buttonByText(h.document, 'Unknown result'));
  assert.equal(buttonByText(h.document, 'Commit draft').disabled, true);
  assert.equal(buttonByText(h.document, 'Cancel draft').disabled, true);
});

test('branded date and UTC instant editors retain string contracts and precision errors block submission', async t => {
  const h = await mountFixture(
    t,
    `
  const record={id:'R',amount:1,date:'2026-10-13',instant:'2026-10-13T09:30:00Z'};const fields=[{key:'amount',label:'Amount',kind:'money',currency:'USD',precision:2,getValue:r=>r.amount,setValue:(r,v)=>({...r,amount:v})},{key:'date',label:'Date',kind:'date',getValue:r=>r.date,setValue:(r,v)=>({...r,date:v})},{key:'instant',label:'Instant',kind:'datetime',getValue:r=>r.instant,setValue:(r,v)=>({...r,instant:v})}];
  export default function Fixture(){const[draft,setDraft]=useState(record);const[commits,setCommits]=useState(0);return <AtlasProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}} onDraftChange={setDraft} onCommit={()=>setCommits(v=>v+1)} onCancel={()=>{}}/><output>{commits}</output></AtlasProvider>}`,
  );
  assert.equal(h.document.querySelector('input[type="date"]'), null);
  assert.equal(h.document.querySelector('[data-field-key="date"] input').value, '2026-10-13');
  assert.match(h.document.querySelector('[data-field-key="instant"] input').value, /UTC/);
  const amount = h.document.querySelector('[data-field-key="amount"] input');
  await h.type(amount, '1.234');
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('output').textContent, '0');
  assert.equal(amount.getAttribute('aria-invalid'), 'true');
  assert.match(
    h.document.querySelector('[data-field-key="amount"]').textContent,
    /supported precision/,
  );
});

test('entity choices share descriptions and IDs while Turkish search and required semantics remain explicit', async t => {
  const h = await mountFixture(
    t,
    `
  export default function Fixture(){const[value,setValue]=useState(null);return <AtlasProvider><EntityPicker id="relation" label="Relation" required value={value} options={[{id:'north',label:'İstanbul',description:'North office'},{id:'south',label:'İstanbul',description:'South office'}]} onChange={setValue}/><output>{value}</output></AtlasProvider>}`,
  );
  const input = h.document.querySelector('#relation');
  assert.equal(input.getAttribute('aria-required'), 'true');
  await h.type(input, 'istanbul');
  await selectOption(h, input, 'İstanbul — South office · south');
  assert.equal(h.document.querySelector('output').textContent, 'south');
});

test('typed comparisons preserve currency and conflict source without permitting unknown retry', async t => {
  const h = await mountFixture(
    t,
    `
  const fields=[{key:'cost',label:'Cost',source:0,current:1,proposed:2,metadata:{kind:'money',currency:'USD',precision:2}}];
  export default function Fixture(){return <AtlasProvider><SourceComparedEntry fields={fields} onUseSource={()=>{}}/><ConflictResolver conflicts={fields} decisions={{}} onDecisionChange={()=>{}}/><ChangeReview targets={[{id:'R',changes:[]}]} results={[{id:'R',state:'unknown',retryable:true}]} onRetry={()=>{}}/></AtlasProvider>}`,
  );
  assert.match(h.document.body.textContent, /\$0\.00/);
  assert.match(
    h.document.querySelector('.kit-conflict-source').textContent,
    /Source value.*\$0\.00/,
  );
  assert.equal(buttonByText(h.document, 'Retry R').disabled, true);
});

test('supplied import corrections retain stable IDs and navigation never marks an item reviewed', async t => {
  const h = await mountFixture(
    t,
    `
  const initial=[{id:'first',fields:[{key:'name',label:'Name',source:'Source A',current:'Current A',proposed:'Draft A'}]},{id:'second',fields:[{key:'name',label:'Name',source:'Source B',current:'Current B',proposed:'Draft B'}],operation:{kind:'unknown'}}];
  export default function Fixture(){const[items,setItems]=useState(initial);const[active,setActive]=useState('first');const[reviewed,setReviewed]=useState([]);return <AtlasProvider><ImportCorrectionQueue items={items} activeId={active} reviewedIds={reviewed} onNavigate={setActive} onCorrection={(id,key,value)=>setItems(items.map(item=>item.id===id?{...item,fields:item.fields.map(field=>field.key===key?{...field,proposed:value}:field)}:item))} onReview={id=>setReviewed([...reviewed,id])}/><output>{JSON.stringify(reviewed)}</output></AtlasProvider>}`,
  );
  await h.click(buttonByText(h.document, 'Use source for Name'));
  assert.match(h.document.querySelector('.kit-import-corrections').textContent, /Source A/);
  await h.click(buttonByText(h.document, 'Mark correction reviewed'));
  assert.equal(h.document.querySelector('output').textContent, '["first"]');
  await h.click(buttonByText(h.document, 'Next correction'));
  assert.equal(h.document.querySelector('[data-correction-id]').dataset.correctionId, 'second');
  assert.equal(h.document.querySelector('output').textContent, '["first"]');
  assert.equal(buttonByText(h.document, 'Mark correction reviewed').disabled, true);
});

test('nested child precision drafts block containing form commit and removal clears keyed errors once', async t => {
  const h = await mountFixture(
    t,
    `
  const record={id:'R',name:'Parent'};const fields=[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];const lines=[{key:'amount',label:'Amount',kind:'number',precision:2,getValue:r=>{if(r.denied)throw Error('opaque child getter');return r.amount;},setValue:(r,v)=>({...r,amount:v})}];
  export default function Fixture(){const[rows,setRows]=useState([{id:'child',amount:1}]);const[denied,setDenied]=useState(false);const[commits,setCommits]=useState(0);const[notifications,setNotifications]=useState([]);return <AtlasProvider><RecordForm record={record} draft={record} fields={fields} errors={{}} onDraftChange={()=>{}} onCommit={()=>setCommits(v=>v+1)} onCancel={()=>{}}><RepeatingRecordEditor rows={rows} fields={lines} statesById={denied?{child:{kind:'denied'}}:{}} onRowsChange={setRows} onDraftErrorsChange={errors=>setNotifications(items=>[...items,errors])}/></RecordForm><button onClick={()=>{setRows([{id:'child',amount:1}]);setDenied(false);}}>Restore child</button><button onClick={()=>{setRows(rows.map(row=>({...row,denied:true})));setDenied(true);}}>Deny child</button><output data-commits="">{commits}</output><output data-errors="">{JSON.stringify(notifications)}</output></AtlasProvider>}`,
  );
  const child = h.document.querySelector('[data-child-id="child"] input');
  await h.type(child, '1.234');
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-commits]').textContent, '0');
  assert.equal(h.document.activeElement, child);
  assert.match(
    h.document.querySelector('.kit-error-summary').textContent,
    /Child record child.*Amount/,
  );
  await h.click(buttonByText(h.document, 'Remove child'));
  await h.submit(h.document.querySelector('form'));
  assert.equal(h.document.querySelector('[data-commits]').textContent, '1');
  const notifications = JSON.parse(h.document.querySelector('[data-errors]').textContent);
  assert.equal(notifications.length, 2, 'one invalid emission and one removal emission');
  assert.match(notifications[0].child.amount, /supported precision/);
  assert.deepEqual(notifications[1], {});
  await h.click(buttonByText(h.document, 'Restore child'));
  await h.type(h.document.querySelector('[data-child-id="child"] input'), '1.234');
  await h.click(buttonByText(h.document, 'Deny child'));
  assert.equal(h.document.querySelector('[data-child-id="child"] input'), null);
  const deniedNotifications = JSON.parse(h.document.querySelector('[data-errors]').textContent);
  assert.equal(deniedNotifications.length, 4);
  assert.deepEqual(deniedNotifications[3], {});
});

test('acknowledged clean commit refreshes the same-ID form base for a second edit', async t => {
  const h = await mountFixture(
    t,
    `
  const fields=[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];
  export default function Fixture(){const[record,setRecord]=useState({id:'R',name:'Base'});const[draft,setDraft]=useState(record);const[bases,setBases]=useState([]);return <AtlasProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}} onDraftChange={setDraft} onCommit={(value,context)=>{setBases([...bases,context.base.name]);setRecord(cloneRecord(value));}} onCancel={()=>{}}/><output>{JSON.stringify(bases)}</output></AtlasProvider>}`,
  );
  const input = h.document.querySelector('[data-field-key="name"] input');
  await h.type(input, 'First');
  await h.submit(h.document.querySelector('form'));
  await h.type(input, 'Second');
  assert.equal(buttonByText(h.document, 'Commit draft').disabled, false);
  assert.equal(h.document.querySelector('[data-kit-form]').dataset.formStale, 'false');
  await h.submit(h.document.querySelector('form'));
  assert.deepEqual(JSON.parse(h.document.querySelector('output').textContent), ['Base', 'First']);
});

test('command and copy-create wrappers preserve dirty bases until an explicit cancel decision', async t => {
  const h = await mountFixture(
    t,
    `
  const fields=[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})}];
  export default function Fixture(){const[parameters,setParameters]=useState({id:'cmd',name:'Command'});const[candidate,setCandidate]=useState({id:'copy',name:'Copy'});const[cancels,setCancels]=useState(0);return <AtlasProvider><CommandForm parameters={parameters} fields={fields} onParametersChange={setParameters} onSubmit={()=>{}} onCancel={()=>setCancels(v=>v+1)}/><CopyCreate source={{id:'source',name:'Source'}} candidate={candidate} fields={fields} onCandidateChange={setCandidate} onCreate={()=>{}} onCancel={()=>setCancels(v=>v+1)}/><output>{cancels}</output></AtlasProvider>}`,
  );
  for (const selector of ['.kit-command-form', '.kit-copy-create']) {
    const wrapper = h.document.querySelector(selector);
    await h.type(wrapper.querySelector('[data-field-key="name"] input'), 'Changed');
    await h.click(buttonByText(wrapper, 'Cancel draft'));
    assert.equal(h.document.querySelector('output').textContent, '0');
    assert.ok(buttonByText(wrapper, 'Keep editing'));
    await h.click(buttonByText(wrapper, 'Keep editing'));
    assert.equal(wrapper.querySelector('[data-field-key="name"] input').value, 'Changed');
  }
});

test('draft metadata cannot weaken original restrictions or invoke protected getters at display or commit', async t => {
  const h = await mountFixture(
    t,
    `
  // React development diagnostics diff enumerable props independently of the kit.
  // The pure clone case above covers enumerable accessors; this UI case isolates field gating.
  let reads=0;const original={id:'R',name:'Base',restricted:true};Object.defineProperty(original,'secret',{enumerable:false,get(){reads++;throw Error('protected getter')}});const draft=cloneRecord(original);draft.name='Changed';draft.restricted=false;
  const fields=[{key:'name',label:'Name',kind:'text',getValue:r=>r.name,setValue:(r,v)=>({...r,name:v})},{key:'secret',label:'Secret',kind:'text',getValue:r=>r.secret,setValue:(r,v)=>({...r,secret:v}),availability:r=>({state:r.restricted?'restricted':'available'})}];
  const state={records:[original],activeId:'R',checkedIds:[],preparedIds:[],draft,original:cloneRecord(original),errors:{},query:{search:'',filters:[],sort:[]},projection:['name'],view:'table',message:'',baseExisted:true};const committed=commitKitDraft(state,fields);const secret=Object.getOwnPropertyDescriptor(committed.records[0],'secret');
  export default function Fixture(){const[saved,setSaved]=useState(null);const[candidate,setCandidate]=useState(draft);return <AtlasProvider><RecordForm record={original} draft={candidate} fields={fields} errors={{}} onDraftChange={setCandidate} onCommit={value=>setSaved({restricted:value.restricted,hasGetter:!!Object.getOwnPropertyDescriptor(value,'secret').get})} onCancel={()=>{}}/><output data-result="">{JSON.stringify({reads,name:committed.records[0].name,restricted:committed.records[0].restricted,hasGetter:!!secret.get})}</output><output data-saved="">{JSON.stringify(saved)}</output></AtlasProvider>}`,
  );
  assert.equal(h.document.querySelector('[data-field-key="secret"] input'), null);
  assert.match(h.document.querySelector('[data-field-key="secret"]').textContent, /Restricted/);
  await h.type(h.document.querySelector('[data-field-key="name"] input'), 'Changed again');
  await h.submit(h.document.querySelector('form'));
  const result = JSON.parse(h.document.querySelector('[data-result]').textContent);
  assert.equal(result.reads, 0);
  assert.equal(result.name, 'Changed');
  assert.equal(result.restricted, true);
  assert.equal(result.hasGetter, true);
  assert.deepEqual(JSON.parse(h.document.querySelector('[data-saved]').textContent), {
    restricted: true,
    hasGetter: true,
  });
});
