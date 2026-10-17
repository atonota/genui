import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const load = async entry => {
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
  );
};

const fieldSample = [
  { key: 'id', label: 'Record ID', kind: 'text', readOnly: true },
  {
    key: 'name',
    label: 'Name',
    kind: 'text',
    required: true,
    help: 'Shown on cards',
    section: 'Profile',
  },
  { key: 'amount', label: 'Amount', kind: 'money', precision: 2, currency: 'USD' },
  {
    key: 'status',
    label: 'Status',
    kind: 'choice',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed', disabled: true },
    ],
  },
  { key: 'note', label: 'Locked note', kind: 'multiline', readOnly: true },
];
const recordSample = [
  { id: 'rec-1', name: 'Ada', amount: 10, status: 'open', note: 'Fixed' },
  { id: 'rec-2', name: '', amount: null },
];

test('record-field bridge parses declarative JSON into trusted FieldDefinitions and rejects callbacks', async () => {
  const core = await load('docs/src/genux/index.ts');
  assert.equal(typeof core.parseNativeFields, 'function');

  const { parseNativeFields, parseNativeRecords, nativeFieldDefinitions } = await load(
    'docs/src/genux/native/record-fields.ts',
  );
  const { applyFieldValue, validateRecord } = await load('docs/src/data/field-kit.ts');

  const fields = parseNativeFields(fieldSample);
  assert.deepEqual(fields, fieldSample);
  const records = parseNativeRecords(recordSample, fields);
  assert.deepEqual(records, recordSample);
  const before = structuredClone(records);

  const definitions = nativeFieldDefinitions(fields, true);
  const byKey = Object.fromEntries(definitions.map(field => [field.key, field]));
  assert.deepEqual(
    definitions.map(field => [field.key, field.kind, typeof field.setValue]),
    [
      ['id', 'text', 'undefined'],
      ['name', 'text', 'function'],
      ['amount', 'money', 'function'],
      ['status', 'choice', 'function'],
      ['note', 'multiline', 'undefined'],
    ],
  );
  assert.equal('readOnly' in byKey.note, false);
  assert.equal('validate' in byKey.name, false);
  assert.equal(byKey.amount.currency, 'USD');
  assert.equal(byKey.name.getValue(records[0]), 'Ada');
  assert.equal(byKey.status.getValue(records[1]), null);

  // Empty drafts survive parsing so the existing field kit reports them.
  assert.deepEqual(validateRecord(records[1], definitions), { name: 'This field is required.' });
  const next = applyFieldValue(records[0], byKey.amount, 12.5);
  assert.equal(next.amount, 12.5);
  assert.notEqual(next, records[0]);
  assert.equal(applyFieldValue(records[0], byKey.status, 'closed'), records[0]);
  assert.equal(applyFieldValue(records[0], byKey.id, 'rec-9'), records[0]);
  assert.equal(applyFieldValue(records[0], byKey.note, 'Changed'), records[0]);
  assert.deepEqual(records, before);
  assert.ok(nativeFieldDefinitions(fields).every(field => field.setValue === undefined));

  const name = fieldSample[1];
  for (const malicious of [
    [{ ...name, validate: () => 'x' }],
    [{ ...name, getValue: 'record => record.secret' }],
    [{ ...name, kind: 'script' }],
    [{ key: 'constructor', label: 'Constructor', kind: 'text' }],
    [name, name],
    Array.from({ length: 25 }, (_, index) => ({ key: `f${index}`, label: 'F', kind: 'text' })),
  ]) {
    assert.throws(() => parseNativeFields(malicious));
    assert.throws(() => nativeFieldDefinitions(malicious, true));
  }
  for (const malicious of [
    [{ id: 'rec-1', secret: 'x' }],
    [{ id: 'rec-1', name: () => 'x' }],
    [{ id: 'rec-1', name: { html: '<b>x</b>' } }],
    [{ id: 'rec-1' }, { id: 'rec-1' }],
    [{ name: 'No ID' }],
  ])
    assert.throws(() => parseNativeRecords(malicious, fields));
  assert.throws(() => parseNativeRecords(recordSample, fields, 1));
});
