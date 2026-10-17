import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { transform } from 'esbuild';
import test from 'node:test';
import { mountPattern, buttonByText } from './harness.mjs';

const entry = 'docs/src/react/cards/index.ts';
const model = (kind = 'entity', extra = {}) => ({
  id: 'record-1',
  kind,
  title: 'GenUX Studio',
  description: 'A shared workspace.',
  primaryAction: { id: 'inspect-1', label: 'Open workspace', intent: 'inspect' },
  ...extra,
});

test('error Cards expose recovery while other primary and secondary actions stay disabled', async t => {
  const calls = [];
  const h = await mountPattern('PurposeCard', entry, {
    model: model('summary', {
      state: 'error',
      primaryAction: { id: 'retry', label: 'Recover card', intent: 'retry' },
      secondaryActions: [{ id: 'inspect', label: 'Inspect failed data', intent: 'inspect' }],
    }),
    onAction: action => calls.push(action.id),
  });
  t.after(() => h.dispose());
  assert.equal(buttonByText(h.document, 'Recover card').disabled, false);
  assert.equal(buttonByText(h.document, 'Inspect failed data').disabled, true);
  await h.click(buttonByText(h.document, 'Inspect failed data'));
  await h.click(buttonByText(h.document, 'Recover card'));
  assert.deepEqual(calls, ['retry']);
});

async function importData(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

test('EntityCard has one named native surface and one host-owned primary action', async t => {
  const calls = [];
  const cardModel = model('entity', {
    facts: [{ key: 'count', label: 'Open tasks', value: 0, format: 'number' }],
    source: {
      label: 'Local sample dataset',
      sourceId: 'sample-1',
      observedAt: '2026-10-14T06:00:00Z',
      mode: 'recorded',
    },
  });
  const h = await mountPattern('EntityCard', entry, {
    model: cardModel,
    primaryActionId: 'collection-open-record-1',
    onAction: (...args) => calls.push(args),
  });
  t.after(() => h.dispose());
  const card = h.document.querySelector(
    'article[data-genux-card], [role="article"][data-genux-card]',
  );
  assert.ok(card?.classList.contains('ant-card'));
  assert.equal(card.classList.contains('ant-card-bordered'), false);
  assert.equal(
    h.document.getElementById(card.getAttribute('aria-labelledby')).textContent,
    'GenUX Studio',
  );
  assert.equal(card.querySelector('dd').textContent, '0', 'zero is an actual value');
  assert.equal(card.querySelectorAll('[data-card-primary]').length, 1);
  assert.equal(card.querySelector('[data-card-primary]').id, 'collection-open-record-1');
  assert.ok(card.querySelector('[data-card-source]').textContent.includes('sample-1'));
  await h.click(buttonByText(card, 'Open workspace'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], cardModel.primaryAction);
  assert.equal(calls[0][1], cardModel);
  assert.equal(card.querySelector('button button, a button, button a'), null);
});

test('MetricCard preserves zero, missing data and explicitly supplied change meaning', async t => {
  const metric = {
    value: 0,
    label: 'Overdue invoices',
    period: 'This month',
    delta: -8,
    comparison: 'Previous month',
    meaning: 'positive',
  };
  const h = await mountPattern('MetricCard', entry, { model: model('metric', { metric }) });
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('[data-card-metric-value]').textContent, '0');
  assert.equal(
    h.document.querySelector('[data-card-delta-meaning]').dataset.cardDeltaMeaning,
    'positive',
  );
  assert.match(h.document.querySelector('[data-card-delta-meaning]').textContent, /-8/);
  const { formatCardMetric } = await importData('../src/data/card-projection.ts');
  assert.equal(formatCardMetric({ ...metric, value: null }, 'en'), 'Not available');
  assert.equal(formatCardMetric({ ...metric, value: 0, currency: 'USD' }, 'en'), '$0.00');
});

test('an explicit status palette index takes priority over semantic tone while tone-only status keeps its native meaning', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {PurposeCard} from '../src/react/cards/index'; import {GenUXAppearanceContext} from '../src/react/GenUXAppearance'; export default function Palette(){ return <GenUXAppearanceContext.Provider value="docs"><PurposeCard model={{id:'indexed',kind:'entity',title:'Indexed status',status:{label:'Draft',tone:'success',colorIndex:0}}}/><PurposeCard model={{id:'semantic',kind:'entity',title:'Semantic status',status:{label:'Needs review',tone:'warning'}}}/></GenUXAppearanceContext.Provider>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  const indexed = h.document.querySelector('[data-card-id="indexed"] .genux-pill');
  const semantic = h.document.querySelector('[data-card-id="semantic"] .genux-pill');
  assert.equal(indexed.dataset.pillColor, 'red');
  assert.equal(
    indexed.classList.contains('ant-tag-success'),
    false,
    'an explicit tone color must not mask the palette',
  );
  assert.equal(semantic.dataset.pillColor, undefined);
  assert.equal(semantic.classList.contains('ant-tag-warning'), true);
  assert.notEqual(
    indexed.style.getPropertyValue('--pill-bg'),
    semantic.style.getPropertyValue('--pill-bg'),
  );
});

test('selection, movement and fields remain controlled and report exactly one immediate change', async t => {
  const selected = [],
    moved = [],
    edited = [];
  const h = await mountPattern('PurposeCard', entry, {
    model: model('selection', {
      selection: { mode: 'multiple', selected: false, group: 'plan' },
      task: { lane: 'planned', priority: 'high', completed: 3, total: 5 },
      fields: [{ key: 'name', label: 'Workspace name', value: 'GenUX' }],
    }),
    onSelectionChange: value => selected.push(value),
    onMove: value => moved.push(value),
    onFieldChange: (...args) => edited.push(args),
  });
  t.after(() => h.dispose());
  const control = h.document.querySelector('input[type="checkbox"]');
  await h.click(control);
  assert.deepEqual(selected, [true]);
  assert.equal(control.checked, false, 'consumer owns selection');
  await h.click(buttonByText(h.document, 'Move to In progress'));
  assert.deepEqual(moved, ['active']);
  assert.equal(h.document.querySelector('[data-card-task]').dataset.cardTask, 'planned');
  const field = h.document.querySelector('input[type="text"]');
  await h.type(field, 'New draft');
  assert.equal(edited.length, 1);
  assert.deepEqual(edited[0].slice(0, 2), ['name', 'New draft']);
  assert.equal(field.value, 'GenUX', 'consumer owns the draft');
});

test('loading Cards block all mutations while retaining their controls', async t => {
  let calls = 0;
  const h = await mountPattern('PurposeCard', entry, {
    model: model('form', {
      state: 'loading',
      fields: [{ key: 'name', label: 'Workspace name', value: 'GenUX' }],
      selection: { mode: 'single', selected: true, group: 'plan' },
      task: { lane: 'active', priority: 'normal', completed: 1, total: 3 },
    }),
    onAction: () => calls++,
    onSelectionChange: () => calls++,
    onMove: () => calls++,
    onFieldChange: () => calls++,
  });
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('[data-genux-card]').getAttribute('aria-busy'), 'true');
  assert.ok(h.document.querySelector('input[type="text"]'));
  for (const control of h.document.querySelectorAll('button, input'))
    assert.equal(control.disabled, true);
  for (const button of h.document.querySelectorAll('button')) await h.click(button);
  assert.equal(calls, 0);
});

test('single selection uses a controlled native Radio and reports one selection', async t => {
  const calls = [];
  const h = await mountPattern('PurposeCard', entry, {
    model: model('selection', {
      selection: { mode: 'single', selected: false, group: 'workspace-plan' },
    }),
    onSelectionChange: selected => calls.push(selected),
  });
  t.after(() => h.dispose());
  const radio = h.document.querySelector('input[type="radio"]');
  assert.equal(radio.name, 'workspace-plan');
  assert.equal(radio.getAttribute('aria-label'), 'Select GenUX Studio (record-1)');
  assert.equal(radio.closest('label').textContent.trim(), 'Select');
  await h.click(radio);
  assert.deepEqual(calls, [true]);
  assert.equal(radio.checked, false, 'host must commit the next selection');
});

test('disabled Cards expose their state and preserve read-only information without invoking actions', async t => {
  let calls = 0;
  const h = await mountPattern('PurposeCard', entry, {
    model: model('status', {
      state: 'disabled',
      stateMessage: 'This account is archived.',
      facts: [{ key: 'balance', label: 'Balance', value: 0, format: 'currency', currency: 'USD' }],
    }),
    onAction: () => calls++,
  });
  t.after(() => h.dispose());
  const card = h.document.querySelector('[data-genux-card]');
  assert.equal(card.getAttribute('aria-disabled'), 'true');
  assert.match(card.querySelector('[role="status"]').textContent, /archived/);
  assert.equal(card.querySelector('dd').textContent, '$0.00');
  await h.click(buttonByText(card, 'Open workspace'));
  assert.equal(calls, 0);
});

test('nested primitives reject the second native Card and keep the outer title readable', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {GenUXCard} from '../src/react/cards/index'; export default function Nested(){ return <GenUXCard title="Outer"><GenUXCard title="Inner">Hidden nested payload</GenUXCard></GenUXCard>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('.ant-card').length, 1);
  assert.equal(h.document.querySelectorAll('.ant-card .ant-card').length, 0);
  assert.equal(
    h.document.querySelector('[data-card-nested-rejected]').getAttribute('role'),
    'alert',
  );
  assert.equal(h.document.querySelector('h4').textContent, 'Outer');
  assert.doesNotMatch(h.document.body.textContent, /Hidden nested payload/);
});

test('recipes cover all 23 purposes and every requested domain with distinct structured data', async () => {
  const { CARD_RECIPES } = await importData('../src/data/card-recipes.ts');
  const { CARD_PURPOSES } = await importData('../src/data/card-model.ts');
  assert.ok(CARD_RECIPES.length >= 31);
  assert.equal(new Set(CARD_RECIPES.map(recipe => recipe.id)).size, CARD_RECIPES.length);
  assert.deepEqual(new Set(CARD_RECIPES.map(recipe => recipe.model.kind)), new Set(CARD_PURPOSES));
  for (const id of [
    'property',
    'land',
    'vehicle',
    'job',
    'sales-metric',
    'widget',
    'recent-orders',
    'pending-approvals',
    'blog',
    'news',
    'course',
    'lesson',
    'social',
    'employee',
    'team-member',
    'consultant',
    'freelancer',
    'customer',
    'task',
    'empty',
    'announcement',
    'help',
  ]) {
    assert.ok(
      CARD_RECIPES.some(recipe => recipe.id === id),
      id,
    );
  }
  for (const recipe of CARD_RECIPES) {
    assert.ok(recipe.category && recipe.description && recipe.model.title);
    assert.equal(JSON.parse(JSON.stringify(recipe)).id, recipe.id, 'serializable recipe');
    assert.ok(recipe.model.source, 'sample provenance is visible');
  }
});

test('a task workspace accepts native tables and several trusted actions within one Card', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {GenUXCard} from '../src/react/cards/index'; import {Table,Button} from 'antd'; export default function Task(){ return <GenUXCard title="Compare suppliers" body={<Table pagination={false} rowKey="id" dataSource={[{id:'one',name:'Aster',price:120}]} columns={[{title:'Supplier',dataIndex:'name'},{title:'Price',dataIndex:'price'}]}/>} actions={<><Button>Review selection</Button><Button>Cancel</Button></>}/>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('.ant-card').length, 1);
  assert.equal(h.document.querySelectorAll('table tbody tr').length, 1);
  assert.equal(h.document.querySelectorAll('.genux-card-actions button').length, 2);
  assert.match(h.document.querySelector('h4').textContent, /Compare suppliers/);
});

test('contextual actions remain distinct from one primary and disabled reasons are associated', async t => {
  const calls = [];
  const cardModel = model('summary', {
    secondaryActions: [
      { id: 'review', label: 'Review changes', intent: 'review' },
      {
        id: 'locked',
        label: 'Connect service',
        intent: 'connect',
        disabled: true,
        reason: 'A workspace administrator must connect this service.',
      },
    ],
  });
  const h = await mountPattern('PurposeCard', entry, {
    model: cardModel,
    onAction: action => calls.push(action.id),
  });
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('[data-card-primary]').length, 1);
  assert.equal(h.document.querySelectorAll('[data-card-secondary]').length, 2);
  await h.click(buttonByText(h.document, 'Review changes'));
  await h.click(buttonByText(h.document, 'Connect service'));
  assert.deepEqual(calls, ['review']);
  const disabled = buttonByText(h.document, 'Connect service');
  assert.equal(disabled.disabled, true);
  assert.match(
    h.document.getElementById(disabled.getAttribute('aria-describedby')).textContent,
    /administrator/,
  );
});

test('trusted secondary action arrays never render more than four contextual controls', async t => {
  const secondaryActions = Array.from({ length: 6 }, (_, index) => ({
    id: `extra-${index}`,
    label: `Extra action ${index}`,
    intent: 'review',
  }));
  const calls = [];
  const cardModel = model('summary', { secondaryActions });
  const h = await mountPattern('PurposeCard', entry, {
    model: cardModel,
    onAction: (...args) => calls.push(args),
  });
  t.after(() => h.dispose());
  const controls = [...h.document.querySelectorAll('[data-card-secondary]')];
  assert.equal(controls.length, 4);
  assert.equal(h.document.querySelectorAll('[data-card-primary]').length, 1);
  assert.equal(buttonByText(h.document, 'Extra action 4'), undefined);
  await h.click(controls[3]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], secondaryActions[3]);
  assert.equal(calls[0][1], cardModel);
});

test('read-only fields remain selectable and reject a dispatched edit without a host mutation', async t => {
  let calls = 0;
  const h = await mountPattern('PurposeCard', entry, {
    model: model('form', {
      fields: [{ key: 'code', label: 'Workspace code', value: 'AT-01', readOnly: true }],
    }),
    onFieldChange: () => calls++,
  });
  t.after(() => h.dispose());
  const input = h.document.querySelector('input[type="text"]');
  assert.equal(input.readOnly, true);
  assert.equal(input.disabled, false);
  assert.ok(input.closest('.ant-input-affix-wrapper').querySelector('.genux-icon'));
  await h.type(input, 'Bypass');
  assert.equal(calls, 0);
  assert.match(
    h.document.getElementById(input.getAttribute('aria-describedby')).textContent,
    /select and copy/,
  );
});

test('field errors associate native invalid controls with unique helpers and retain read-only copying', async t => {
  const h = await mountPattern('PurposeCard', entry, {
    model: model('form', {
      fields: [
        {
          key: 'name',
          label: 'Workspace name',
          value: '',
          required: true,
          error: 'Enter a workspace name.',
        },
        {
          key: 'code',
          label: 'Workspace code',
          value: 'AT-01',
          readOnly: true,
          error: 'This workspace code needs review.',
        },
      ],
    }),
    onFieldChange: () => {},
  });
  t.after(() => h.dispose());
  const inputs = [...h.document.querySelectorAll('.genux-card-fields input')];
  const errorIds = [];
  for (const input of inputs) {
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    const helperIds = input.getAttribute('aria-describedby').split(/\s+/);
    const error = helperIds
      .map(id => h.document.getElementById(id))
      .find(node => node?.classList.contains('genux-card-field-error'));
    assert.ok(error?.textContent);
    assert.equal(error.getAttribute('role'), 'alert');
    assert.ok(
      input.closest('.ant-input-status-error'),
      'native6.6 status class owns either the input or its affix wrapper',
    );
    errorIds.push(error.id);
  }
  assert.equal(new Set(errorIds).size, 2);
  assert.equal(inputs[1].readOnly, true);
  assert.equal(inputs[1].disabled, false);
  assert.equal(inputs[1].getAttribute('aria-describedby').split(/\s+/).length, 2);
});

test('adding and clearing validation errors preserves exact field nodes and owned draft values', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {useState} from 'react'; import {PurposeCard} from '../src/react/cards/index'; export default function Validation(){ const [error,setError]=useState(false); const [value,setValue]=useState('GenUX draft'); return <><button id="validate" onClick={()=>setError(current=>!current)}>Validate fields</button><PurposeCard model={{id:'validation',kind:'form',title:'Workspace settings',fields:[{key:'name',label:'Workspace name',value,error:error?'Enter a workspace name.':undefined},{key:'code',label:'Workspace code',value:'AT-01',readOnly:true,error:error?'This workspace code needs review.':undefined}]}} onFieldChange={(_,next)=>setValue(next)}/></>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  const [editable, readonly] = [...h.document.querySelectorAll('.genux-card-fields input')];
  await h.type(editable, 'Keep this draft');
  await h.act(() => {
    editable.focus();
    editable.setSelectionRange(2, 5);
  });
  await h.click(h.document.getElementById('validate'));
  assert.deepEqual(
    [...h.document.querySelectorAll('.genux-card-fields input')],
    [editable, readonly],
  );
  assert.equal(editable.value, 'Keep this draft');
  assert.equal(editable.selectionStart, 2);
  assert.equal(editable.getAttribute('aria-invalid'), 'true');
  assert.equal(readonly.disabled, false);
  await h.click(h.document.getElementById('validate'));
  assert.deepEqual(
    [...h.document.querySelectorAll('.genux-card-fields input')],
    [editable, readonly],
  );
  assert.equal(editable.getAttribute('aria-invalid'), null);
  assert.equal(editable.getAttribute('aria-describedby'), null);
  assert.equal(readonly.getAttribute('aria-describedby').split(/\s+/).length, 1);
  assert.equal(h.document.querySelectorAll('.genux-card-field-error').length, 0);
});

test('size, language and loading changes preserve controlled drafts, focused nodes and expansion', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {useState} from 'react'; import {PurposeCard} from '../src/react/cards/index'; import GenUXProvider from '../src/react/GenUXProvider'; import {GenUXSizeContext} from '../src/react/GenUXSizeProfile'; export default function Stable(){ const [size,setSize]=useState('md'); const [value,setValue]=useState('Initial draft'); const [loading,setLoading]=useState(false); return <GenUXProvider appearance="docs"><button id="large" onClick={()=>setSize('lg')}>Large profile</button><button id="small" onClick={()=>setSize('sm')}>Small profile</button><button id="loading" onClick={()=>setLoading(v=>!v)}>Toggle loading</button><GenUXSizeContext.Provider value={size}><PurposeCard model={{id:'stable',kind:'form',title:'Workspace settings',state:loading?'loading':'ready',fields:[{key:'name',label:'Workspace name',value}],details:{heading:'Evidence and limitations',body:'A persistent explanation.'}}} onFieldChange={(_,next)=>setValue(next)}/></GenUXSizeContext.Provider></GenUXProvider>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  const input = h.document.querySelector('.genux-card-fields input');
  await h.type(input, 'Keep this draft');
  const expand = h.document.querySelector('button[aria-controls][aria-expanded]');
  await h.click(expand);
  const details = h.document.getElementById(expand.getAttribute('aria-controls'));
  assert.equal(details.getAttribute('aria-hidden'), 'false');
  await h.act(() => {
    input.focus();
    input.setSelectionRange(2, 5);
  });
  await h.click(h.document.getElementById('large'));
  assert.equal(h.document.querySelector('[data-genux-card]').dataset.cardProfile, 'lg');
  assert.equal(input.value, 'Keep this draft');
  assert.equal(h.document.activeElement, input);
  assert.equal(input.selectionStart, 2);
  await h.act(() => h.setLocale('tr'));
  await h.click(h.document.getElementById('small'));
  assert.equal(h.document.querySelector('[data-genux-card]').dataset.cardProfile, 'sm');
  assert.ok(h.document.querySelector('[data-genux-card]').classList.contains('ant-card-small'));
  await h.click(h.document.getElementById('loading'));
  assert.equal(h.document.querySelector('.genux-card-fields input'), input);
  assert.equal(input.value, 'Keep this draft');
  assert.equal(input.disabled, true);
  await h.click(h.document.getElementById('loading'));
  assert.equal(input.disabled, false);
  assert.equal(h.document.getElementById(expand.getAttribute('aria-controls')), details);
  assert.equal(details.getAttribute('aria-hidden'), 'false');
});

test('fact projection preserves date-only meaning and displays observed instants in UTC', async () => {
  const { formatCardFact, formatCardBytes } = await importData('../src/data/card-projection.ts');
  assert.equal(
    formatCardFact({ key: 'date', label: '', value: '2026-02-30', format: 'date' }),
    '2026-02-30',
  );
  assert.match(
    formatCardFact({ key: 'date', label: '', value: '2026-10-14', format: 'date' }),
    /Oct 14, 2026/,
  );
  assert.match(
    formatCardFact({ key: 'time', label: '', value: '2026-10-14T09:00:00+03:00', format: 'date' }),
    /6:00 AM UTC/,
  );
  assert.equal(formatCardBytes(0), '0 B');
  assert.equal(formatCardBytes(1024), '1 KiB');
});

test('all domain recipes render as independent named Cards with unique field and heading identities', async t => {
  const fixture = `.card-primitive-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `import {PurposeCard} from '../src/react/cards/index'; import {CARD_RECIPES} from '../src/data/card-recipes'; export default function Recipes(){ return <section>{CARD_RECIPES.map(recipe=><PurposeCard key={recipe.id} model={recipe.model} onAction={()=>{}}/>)}</section>; }`,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  const { CARD_RECIPES } = await importData('../src/data/card-recipes.ts');
  const cards = [...h.document.querySelectorAll('[data-genux-card]')];
  assert.equal(cards.length, CARD_RECIPES.length);
  assert.equal(h.document.querySelectorAll('.ant-card .ant-card').length, 0);
  assert.equal(new Set(cards.map(card => card.getAttribute('aria-labelledby'))).size, cards.length);
  for (const card of cards) {
    assert.ok(h.document.getElementById(card.getAttribute('aria-labelledby'))?.textContent);
    assert.equal(card.querySelectorAll('[data-card-primary]').length, 1);
    assert.ok(card.querySelector('[data-card-source]'));
    for (const input of card.querySelectorAll('input[type="text"]')) {
      assert.equal(h.document.querySelectorAll(`[id="${input.id}"]`).length, 1);
      assert.ok(card.querySelector(`label[for="${input.id}"]`));
    }
  }
});
