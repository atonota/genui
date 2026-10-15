import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';
import {
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
  type NativeRecordField,
} from './record-fields';

export const REPEATING_RECORDS_LIMIT = 24;
const allowed = ['label', 'fields', 'value', 'minRows', 'maxRows', 'rowTemplate', 'readOnly'];
const required = ['fields', 'value'];

export type RepeatingRecordsState = Readonly<{
  label: string;
  fields: readonly NativeRecordField[];
  rows: readonly NativeRecord[];
  minRows: number;
  maxRows: number;
  template: NativeRecord;
  readOnly: boolean;
}>;

function rowCount(value: JsonValue | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > REPEATING_RECORDS_LIMIT
  )
    throw new Error(`${label} must be an integer from 0 to ${REPEATING_RECORDS_LIMIT}.`);
  return value;
}

/** Declared fields default to null; the template may only supply declared scalars, never an ID. */
function templateRow(fields: readonly NativeRecordField[], template: JsonValue | undefined) {
  if (
    template !== undefined &&
    (!template || typeof template !== 'object' || Array.isArray(template))
  )
    throw new Error('Row template must be an object.');
  if (template && Object.hasOwn(template, 'id'))
    throw new Error('Row template cannot supply a child ID.');
  const defaults = Object.fromEntries(
    fields.filter(field => field.key !== 'id').map(field => [field.key, null]),
  );
  return parseNativeRecords([{ ...defaults, ...template, id: 'row-template' }], fields, 1)[0]!;
}

function read(input: unknown): [NativePayload, RepeatingRecordsState] {
  const data = nativeRecord(input, allowed, required);
  const label = data.label ?? 'Repeating records';
  if (typeof label !== 'string' || !label.trim() || label.length > 120)
    throw new Error('Repeating records label is invalid.');
  if (data.readOnly !== undefined && typeof data.readOnly !== 'boolean')
    throw new Error('Repeating records readOnly must be a boolean.');
  const fields = parseNativeFields(data.fields);
  const minRows = rowCount(data.minRows, 0, 'minRows');
  const maxRows = rowCount(data.maxRows, REPEATING_RECORDS_LIMIT, 'maxRows');
  if (minRows > maxRows) throw new Error('minRows cannot exceed maxRows.');
  const rows = parseNativeRecords(data.value, fields, maxRows);
  if (rows.length < minRows || rows.length > maxRows)
    throw new Error('Row count is outside the supported bounds.');
  return [
    data,
    {
      label,
      fields,
      rows,
      minRows,
      maxRows,
      template: templateRow(fields, data.rowTemplate),
      readOnly: data.readOnly === true,
    },
  ];
}

export function readRepeatingRecords(input: unknown): RepeatingRecordsState {
  return read(input)[1];
}

/** Trusted local row creation: a fresh UUID identity over the validated template. */
export function createRepeatingRow(state: RepeatingRecordsState): NativeRecord {
  return { ...state.template, id: `row-${globalThis.crypto.randomUUID()}` };
}

export const definition: NativeDefinition = {
  name: 'AtlasRepeatingRecords',
  readOnly: false,
  parse(input) {
    const [data, state] = read(input);
    return { ...data, value: structuredClone(state.rows) as unknown as JsonValue };
  },
  withValue(data, value) {
    const current = readRepeatingRecords(data);
    if (current.readOnly) throw new Error('AtlasRepeatingRecords is read-only.');
    // Re-parse the whole candidate so bounds, unique IDs and declared scalars hold.
    const next = definition.parse({ ...data, value });
    // Existing rows keep read-only fields from the current value; new rows use the defaults.
    const baseline = new Map(current.rows.map(row => [row.id, row]));
    const locked = current.fields.filter(field => field.readOnly);
    for (const row of readRepeatingRecords(next).rows) {
      const base = baseline.get(row.id);
      if (base && locked.some(field => row[field.key] !== base[field.key]))
        throw new Error('Read-only fields cannot change on an existing row.');
    }
    return next;
  },
};

export const sample: NativePayload = {
  label: 'Order lines',
  fields: [
    { key: 'item', label: 'Item', kind: 'text', required: true },
    { key: 'quantity', label: 'Quantity', kind: 'number' },
  ],
  value: [
    { id: 'line-a', item: 'Paper', quantity: 2 },
    { id: 'line-b', item: 'Ink', quantity: 1 },
  ],
  minRows: 1,
  maxRows: 4,
  rowTemplate: { quantity: 1 },
};
