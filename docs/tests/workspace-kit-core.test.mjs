import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mountPattern, selectOption, buttonByText } from './harness.mjs';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';

const compiled = await build({
  entryPoints: ['docs/src/data/workspace-kit.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const kit = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);

test('kit UI messages and schema labels have Turkish translations with matching parameters', async () => {
  const dictionaryNames = [
    'docs',
    'react',
    'workspace',
    'kit-core',
    'kit-collections',
    'kit-records',
    'kit-docs',
    'gap-collections-fixes',
    'gap-form-fixes',
    'gap-display-fixes',
    'gap-shared-fixes',
  ];
  const dictionaries = await Promise.all(
    dictionaryNames.map(async name =>
      JSON.parse(await readFile(`docs/src/locales/tr/${name}.json`, 'utf8')),
    ),
  );
  const messages = Object.assign(
    {},
    JSON.parse(await readFile('src/i18n/tr.json', 'utf8')),
    ...dictionaries,
  );
  const keys = new Set();
  const strings = node => {
    if (ts.isStringLiteral(node) && node.text.trim()) keys.add(node.text);
    else if (ts.isConditionalExpression(node)) {
      strings(node.whenTrue);
      strings(node.whenFalse);
    }
  };
  const directory = 'docs/src/react/workspace/kit';
  const paths = [
    ...(await readdir(directory))
      .filter(name => name.endsWith('.tsx'))
      .map(name => `${directory}/${name}`),
    'docs/src/data/field-kit.ts',
    'docs/src/data/collection-kit.ts',
    'docs/src/data/workspace-kit.ts',
  ];
  for (const path of paths) {
    const source = ts.createSourceFile(
      path,
      await readFile(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = node => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0]
      )
        strings(node.arguments[0]);
      if (
        ts.isVariableDeclaration(node) &&
        (node.name.getText(source).endsWith('LABELS') || node.name.getText(source) === 'labels') &&
        node.initializer
      ) {
        const value = ts.isAsExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        if (ts.isObjectLiteralExpression(value))
          for (const property of value.properties)
            if (ts.isPropertyAssignment(property)) strings(property.initializer);
      }
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source);
        const stateObject =
          ts.isObjectLiteralExpression(node.parent) &&
          node.parent.properties.some(
            property =>
              ts.isPropertyAssignment(property) &&
              ['state', 'kind', 'allowed'].includes(property.name.getText(source)),
          );
        if (['message', 'recoveryLabel'].includes(name) || (name === 'reason' && stateObject))
          strings(node.initializer);
      }
      if (
        ts.isReturnStatement(node) &&
        node.expression &&
        ts.isStringLiteral(node.expression) &&
        /^[A-Z][a-z].*\s/.test(node.expression.text)
      )
        strings(node.expression);
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ['invalid', 'message'].includes(node.expression.text)
      )
        for (const argument of node.arguments)
          if (ts.isStringLiteral(argument) && /^[A-Z]/.test(argument.text)) strings(argument);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const schema of [kit.ORDER_SCHEMA, kit.EQUIPMENT_SCHEMA])
    for (const field of schema.fields) {
      keys.add(field.label);
      if (field.section) keys.add(field.section);
      if (field.help) keys.add(field.help);
      if (field.kind === 'choice')
        for (const option of field.options ?? [])
          if (!['USD', 'EUR'].includes(option.label)) keys.add(option.label);
    }
  assert.deepEqual(
    [...keys].filter(key => !messages[key]?.trim()),
    [],
  );
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const dictionary of dictionaries.slice(3))
    for (const [key, value] of Object.entries(dictionary))
      assert.deepEqual(parameters(value), parameters(key), key);
});

test('two schemas share typed value, validation and query semantics without changing zero into null', () => {
  for (const schema of [kit.ORDER_SCHEMA, kit.EQUIPMENT_SCHEMA]) {
    const records = schema.initialRecords();
    assert.ok(records.length > 1);
    assert.ok(schema.fields.some(field => field.kind === 'money'));
    const field = schema.fields.find(field => field.kind === 'money');
    const zero = records.find(record => field.getValue(record) === 0);
    const unset = records.find(record => field.getValue(record) === null);
    assert.ok(zero && unset);
    assert.notEqual(kit.formatFieldValue(zero, field), kit.formatFieldValue(unset, field));
    assert.equal(kit.formatFieldValue(unset, field), 'Not set');
    const query = {
      search: '',
      sort: [],
      filters: [{ id: 'zero', fieldKey: field.key, operator: 'eq', value: 0 }],
    };
    assert.deepEqual(
      kit.queryKitRecords(records, schema.fields, query).map(record => record.id),
      [zero.id],
    );
    assert.deepEqual(
      kit.queryKitRecords(records, schema.fields, {
        ...query,
        filters: [{ ...query.filters[0], operator: 'gte', value: null }],
      }),
      [],
    );
    assert.deepEqual(
      kit.queryKitRecords(records, schema.fields, {
        ...query,
        filters: [{ ...query.filters[0], operator: 'gte', value: '0' }],
      }),
      [],
    );
  }
});

test('read availability prevents restricted value access, while editability keeps readable values visible', () => {
  const record = { id: 'R-1', value: 'Visible value' };
  const hidden = {
    key: 'secret',
    label: 'Secret',
    kind: 'text',
    getValue: () => {
      throw Error('Restricted value accessed');
    },
    setValue: (r, value) => ({ ...r, value }),
    availability: () => ({ state: 'restricted', reason: 'Supplied restriction.' }),
    filterOperators: ['contains', 'eq'],
  };
  assert.equal(kit.formatFieldValue(record, hidden), 'Restricted');
  assert.doesNotThrow(() => kit.validateRecord(record, [hidden]));
  assert.deepEqual(
    kit.queryKitRecords([record], [hidden], { search: 'secret', filters: [], sort: [] }),
    [],
  );
  assert.deepEqual(
    kit.queryKitRecords([record], [hidden], {
      search: '',
      filters: [{ id: 's', fieldKey: 'secret', operator: 'eq', value: 'secret' }],
      sort: [],
    }),
    [],
  );
  assert.equal(kit.applyFieldValue(record, hidden, 'Change'), record);
  const readOnly = {
    ...hidden,
    key: 'value',
    getValue: r => r.value,
    availability: () => ({ state: 'available' }),
    editable: () => ({ allowed: false, reason: 'Supplied read-only field.' }),
  };
  assert.equal(kit.formatFieldValue(record, readOnly), 'Visible value');
  assert.equal(kit.applyFieldValue(record, readOnly, 'Change'), record);
  assert.equal(
    kit.validateFieldValue(record, { ...readOnly, required: true }, ''),
    'Supplied read-only field.',
  );
  for (const state of ['unavailable', 'not-applicable', 'unknown'])
    assert.notEqual(
      kit.formatFieldValue(record, { ...hidden, availability: () => ({ state }) }),
      'Not set',
    );
});

test('date-only ranges and UTC instants use distinct validation and chronology; duration and units preserve precision', () => {
  assert.equal(kit.validDateOnly('2026-02-30'), false);
  assert.equal(kit.validDateOnly('2028-02-29'), true);
  assert.equal(kit.validInstant('2026-10-13T09:30:00'), false);
  assert.equal(kit.validInstant('2026-10-13T09:30:00+03:00'), true);
  assert.equal(
    kit.validateDateRange('2026-10-14', '2026-10-13'),
    'End date must be on or after the start date.',
  );
  assert.equal(kit.validateDateRange('2026-10-14', '2026-10-14'), null);
  assert.equal(kit.validateDateRange(null, '2026-10-14'), null);
  const records = kit.initialEquipmentRecords();
  const instant = kit.EQUIPMENT_FIELDS.find(field => field.key === 'lastServicedInstant');
  assert.match(kit.formatFieldValue(records[0], instant), /UTC/);
  const dated = [
    { ...records[0], lastServicedInstant: '2026-10-02T09:30:00+03:00' },
    { ...records[1], lastServicedInstant: '2026-10-02T07:00:00Z' },
  ];
  assert.deepEqual(
    kit
      .queryKitRecords(dated, kit.EQUIPMENT_FIELDS, {
        search: '',
        filters: [],
        sort: [{ fieldKey: instant.key, direction: 'asc' }],
      })
      .map(record => record.id),
    [dated[0].id, dated[1].id],
  );
  assert.deepEqual(
    kit
      .queryKitRecords(dated, kit.EQUIPMENT_FIELDS, {
        search: '',
        sort: [],
        filters: [
          { id: 'instant', fieldKey: instant.key, operator: 'eq', value: '2026-10-02T06:30:00Z' },
        ],
      })
      .map(record => record.id),
    [dated[0].id],
  );
  const invalid = {
    ...records[0],
    calibrationEnd: '2026-10-13',
    serviceMinutes: 1.5,
    weightKg: 1.1234,
  };
  const errors = kit.validateRecord(invalid, kit.EQUIPMENT_FIELDS);
  assert.ok(errors.calibrationEnd && errors.serviceMinutes && errors.weightKg);
  assert.equal(kit.safeDecimal(0.1 + 0.2, 2), true);
  assert.equal(kit.safeDecimal(0, 2), true);
  assert.equal(kit.safeDecimal(Infinity, 2), false);
  assert.equal(kit.safeDecimal(Number.MAX_SAFE_INTEGER, 2), false);
  assert.equal(kit.safeDecimal(1.234, 2), false);
  assert.match(
    kit.formatFieldValue(
      records[0],
      kit.EQUIPMENT_FIELDS.find(field => field.key === 'weightKg'),
    ),
    /2\.125 kg/,
  );
  assert.match(
    kit.formatFieldValue(
      records[0],
      kit.EQUIPMENT_FIELDS.find(field => field.key === 'serviceMinutes'),
    ),
    /90 min/,
  );
});

test('connected local datasets keep committed records, drafts, active/check/prepared identities independent', () => {
  for (const schema of [kit.ORDER_SCHEMA, kit.EQUIPMENT_SCHEMA]) {
    const initial = kit.initialKitState(schema);
    const original = initial.records[0];
    const staged = { ...initial, checkedIds: [original.id], preparedIds: [initial.records[1].id] };
    let state = kit.beginKitDraft(staged, schema, original.id);
    const title = schema.fields.find(field => field.key === 'title');
    state = {
      ...state,
      draft: title.setValue(state.draft, 'Updated shared record'),
      activeId: initial.records[1].id,
      checkedIds: [],
    };
    assert.equal(state.records[0].title, original.title);
    assert.deepEqual(state.preparedIds, [initial.records[1].id]);
    const discarded = kit.discardKitDraft(state);
    assert.equal(discarded.records[0].title, original.title);
    const committed = kit.commitKitDraft(state, schema.fields);
    assert.equal(committed.records[0].title, 'Updated shared record');
    assert.equal(committed.activeId, original.id);
    assert.equal(committed.draft, null);
    assert.deepEqual(committed.checkedIds, []);
    assert.deepEqual(committed.preparedIds, [initial.records[1].id]);
    assert.equal(initial.records[0].title, original.title, 'source dataset must remain immutable');
    const other = kit.beginKitDraft(staged, schema, original.id);
    const identityChange = kit.commitKitDraft(
      { ...other, draft: { ...other.draft, id: 'different-id' } },
      schema.fields,
    );
    assert.equal(identityChange.records, other.records);
    assert.match(identityChange.message, /identity/);
  }
});

test('create is explicit, invalid drafts stay uncommitted and supplied read-only records cannot start an edit', () => {
  let state = kit.initialKitState(kit.EQUIPMENT_SCHEMA);
  const count = state.records.length;
  state = kit.beginKitDraft(state, kit.EQUIPMENT_SCHEMA);
  assert.equal(state.records.length, count);
  state = kit.commitKitDraft(state, kit.EQUIPMENT_FIELDS);
  assert.ok(state.errors.title && state.errors.location);
  assert.equal(state.records.length, count);
  state = { ...state, draft: { ...state.draft, title: 'New meter', location: 'Lab C' } };
  state = kit.commitKitDraft(state, kit.EQUIPMENT_FIELDS);
  assert.equal(state.records.length, count + 1);
  assert.equal(state.records.at(-1).id, state.activeId);
  assert.equal(state.draft, null);
  const readOnly = state.records.find(record => record.readOnly);
  assert.equal(kit.beginKitDraft(state, kit.EQUIPMENT_SCHEMA, readOnly.id).draft, null);
});

test('connected workspace exposes one controlled active dataset and keeps the committed record display distinct from a draft', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/kit/ConnectedWorkspace.tsx');
  t.after(() => h.dispose());
  assert.equal(h.document.querySelectorAll('[data-connected-schema]').length, 1);
  assert.ok(h.document.querySelector('#kit-record-schema'));
  const create = h.document.querySelector('#kit-orders-create');
  await h.click(create);
  assert.match(h.document.body.textContent, /Creating a local draft/);
  assert.equal(h.document.querySelectorAll('[data-connected-schema]').length, 1);
  assert.ok(
    h.document.querySelector('[data-field-frame]'),
    'the form uses shared FieldEditor frames',
  );
  const title = h.document.querySelector('[data-kit-form] [data-field-key="title"] input');
  await h.type(title, 'Retained order draft');
  await h.click(h.document.querySelector('#connected-kit-desktop'));
  assert.equal(
    h.document.querySelector('[data-kit-form] [data-field-key="title"] input'),
    title,
    'layout switches retain the field node',
  );
  await selectOption(h, h.document.querySelector('#kit-record-schema'), 'Equipment');
  assert.equal(h.document.querySelectorAll('[data-connected-schema]').length, 1);
  await selectOption(h, h.document.querySelector('#kit-record-schema'), 'Orders');
  assert.equal(
    h.document.querySelector('[data-kit-form] [data-field-key="title"] input').value,
    'Retained order draft',
  );
});

test('visible grid drafts survive schema changes and explicit grid commit updates the connected display', async t => {
  const h = await mountPattern('default', 'docs/src/react/workspace/kit/ConnectedWorkspace.tsx');
  t.after(() => h.dispose());
  assert.ok(
    h.document.querySelector('.genux-demo'),
    'the documentation island owns its GenUX provider',
  );
  const grid = h.document.querySelector('.kit-editable-grid');
  await h.click(grid.querySelector('[data-edit-trigger="SP-26-0401::title"]'));
  await h.type(grid.querySelector('[data-editing-cell="true"] input'), 'Not set');
  assert.match(
    h.document.querySelector('[data-kit-display] [data-read-field="title"]').textContent,
    /Prototype material order/,
  );
  await selectOption(h, h.document.querySelector('#kit-record-schema'), 'Equipment');
  await selectOption(h, h.document.querySelector('#kit-record-schema'), 'Orders');
  const restored = h.document.querySelector('.kit-editable-grid');
  assert.match(restored.textContent, /1 row drafts retained/);
  await h.click(buttonByText(restored, 'Commit all drafts'));
  assert.match(
    h.document.querySelector('[data-kit-display] [data-read-field="title"]').textContent,
    /Not set/,
  );
  assert.match(h.document.body.textContent, /Grid drafts committed locally/);
});

test('field translation preserves supplied text that happens to equal a UI phrase', async t => {
  const h = await mountPattern('FieldValue', 'docs/src/react/workspace/kit/Fields.tsx', {
    record: { id: 'phrase', value: 'Not set' },
    field: { key: 'value', label: 'Title', kind: 'text', getValue: record => record.value },
  });
  t.after(() => h.dispose());
  await h.act(async () => h.setLocale('tr'));
  assert.equal(h.document.querySelector('[data-field-value="value"]').textContent, 'Not set');
});

test('entity labels remain supplied data when a person name happens to equal a UI phrase', async t => {
  const h = await mountPattern('FieldValue', 'docs/src/react/workspace/kit/Fields.tsx', {
    record: { id: 'entity', person: 'person-01' },
    field: {
      key: 'person',
      label: 'Owner',
      kind: 'entity',
      getValue: record => record.person,
      options: [{ value: 'person-01', label: 'None' }],
    },
  });
  t.after(() => h.dispose());
  await h.act(async () => h.setLocale('tr'));
  assert.equal(
    h.document.querySelector('[data-field-value="person"]').textContent,
    'None · person-01',
  );
});
