import type { FieldKind } from '../../react/workspace/kit/contracts';
import {
  assertId,
  assertPlainJSON,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';
import {
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
  type NativeRecordField,
} from './record-fields';

export const RECORD_FORM_ORGANIZATIONS = [
  'page',
  'sections',
  'steps',
  'tabs',
  'accordion',
] as const;
export type RecordFormOrganization = (typeof RECORD_FORM_ORGANIZATIONS)[number];
export type NativeRecordForm = Readonly<{
  title: string;
  organization: RecordFormOrganization;
  fields: readonly NativeRecordField[];
  record: NativeRecord;
  value: NativeRecord;
}>;

const allowed = ['title', 'organization', 'fields', 'record', 'value'] as const;
const required = ['fields', 'record', 'value'] as const;

// Shape only; domain rules (required, precision, options) stay with validateRecord.
const scalarType: Readonly<Record<FieldKind, 'string' | 'number' | 'boolean'>> = {
  text: 'string',
  multiline: 'string',
  date: 'string',
  datetime: 'string',
  choice: 'string',
  entity: 'string',
  number: 'number',
  money: 'number',
  unit: 'number',
  duration: 'number',
  boolean: 'boolean',
};

function declaredRecord(
  input: unknown,
  fields: readonly NativeRecordField[],
  label: string,
): NativeRecord {
  const [record] = parseNativeRecords([input], fields, 1);
  if (!record) throw new Error(`${label} is required.`);
  assertId(record.id, `${label} ID`);
  for (const field of fields) {
    if (!Object.hasOwn(record, field.key)) throw new Error(`${label} must declare ${field.key}.`);
    const value = record[field.key];
    if (value !== null && typeof value !== scalarType[field.kind])
      throw new Error(`${label} value for ${field.key} has the wrong type.`);
  }
  return record;
}

/** Typed view of a payload; the draft may be incomplete but never re-identified or widened. */
export function readRecordForm(input: unknown): NativeRecordForm {
  const data = nativeRecord(input, allowed, required);
  if (
    data.title !== undefined &&
    (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 120)
  )
    throw new Error('Record form title is invalid.');
  const organization = data.organization ?? 'page';
  if (!RECORD_FORM_ORGANIZATIONS.some(option => option === organization))
    throw new Error('Record form organization is invalid.');
  const fields = parseNativeFields(data.fields);
  const record = declaredRecord(data.record, fields, 'Record');
  const value = declaredRecord(data.value, fields, 'Draft');
  if (value.id !== record.id) throw new Error('The draft record identity cannot change.');
  for (const field of fields)
    if (field.readOnly && value[field.key] !== record[field.key])
      throw new Error(`Read-only field ${field.key} cannot change.`);
  return {
    title: (data.title as string | undefined) ?? 'Record entry',
    organization: organization as RecordFormOrganization,
    fields,
    record,
    value,
  };
}

export const definition: NativeDefinition = {
  name: 'GenUXRecordForm',
  readOnly: false,
  parse(input) {
    const data = nativeRecord(input, allowed, required);
    readRecordForm(data);
    return data;
  },
  withValue(data, value) {
    // Reject accessors and host objects before the draft is copied into the payload.
    assertPlainJSON(value);
    return definition.parse({ ...data, value });
  },
};

export const sample: NativePayload = {
  title: 'Account draft',
  organization: 'sections',
  fields: [
    { key: 'name', label: 'Account name', kind: 'text', required: true, section: 'Profile' },
    { key: 'owner', label: 'Owner', kind: 'text', section: 'Profile' },
    { key: 'region', label: 'Region', kind: 'text', readOnly: true, section: 'Plan' },
  ],
  record: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace', region: 'EU' },
  value: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace', region: 'EU' },
};
