import type {
  FieldDefinition,
  FieldKind,
  FieldOption,
  FieldScalar,
} from '../../react/workspace/kit/contracts';
import type { JsonValue } from '../contracts';
import { assertId, assertPlainJSON, GENUX_LIMITS, UNSAFE_JSON_KEYS } from '../native-contract';

// Declarative JSON bridge between native GenUX payloads and the callback-based
// FieldDefinition contract. Data only describes fields; every callback below is
// code-owned, so payloads can never serialize getters, setters or validators.

export type NativeRecord = { id: string } & Record<string, FieldScalar>;
export type NativeRecordField = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  readOnly?: boolean;
  help?: string;
  section?: string;
  precision?: number;
  currency?: string;
  unit?: string;
  timezone?: string;
  options?: FieldOption[];
};

const MAX_FIELDS = 24;
const MAX_OPTIONS = 100;
const DEFAULT_MAX_RECORDS = 100;
const MAX_RECORDS = 256;
const FIELD_KINDS: ReadonlySet<string> = new Set<FieldKind>([
  'text',
  'multiline',
  'number',
  'money',
  'unit',
  'date',
  'datetime',
  'duration',
  'boolean',
  'choice',
  'entity',
]);
const FIELD_KEYS: ReadonlySet<string> = new Set([
  'key',
  'label',
  'kind',
  'required',
  'readOnly',
  'help',
  'section',
  'precision',
  'currency',
  'unit',
  'timezone',
  'options',
]);
const OPTION_KEYS: ReadonlySet<string> = new Set(['value', 'label', 'description', 'disabled']);

type JsonObject = Readonly<Record<string, JsonValue>>;

function jsonObject(value: JsonValue, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value;
}

function approvedKeys(value: JsonObject, allowed: ReadonlySet<string>, label: string): void {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw new Error(`${label} property ${key} is not approved.`);
}

function boundedText(value: JsonValue | undefined, label: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error(`${label} is invalid.`);
  return value;
}

function safeKey(value: JsonValue | undefined, label: string): string {
  assertId(value, label);
  if (UNSAFE_JSON_KEYS.has(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function isScalar(value: unknown): value is FieldScalar {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function validTimezone(value: string): boolean {
  if (value === 'date-only') return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function parseOptions(value: JsonValue | undefined): FieldOption[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OPTIONS)
    throw new Error('Native field options are invalid.');
  const values = new Set<string>();
  return value.map(item => {
    const source = jsonObject(item, 'Native field option');
    approvedKeys(source, OPTION_KEYS, 'Native field option');
    const option: { -readonly [K in keyof FieldOption]: FieldOption[K] } = {
      value: boundedText(source.value, 'Native field option value', 160),
      label: boundedText(source.label, 'Native field option label', 160),
    };
    if (values.has(option.value))
      throw new Error(`Native field option ${option.value} is duplicated.`);
    values.add(option.value);
    if (Object.hasOwn(source, 'description'))
      option.description = boundedText(source.description, 'Native field option description', 400);
    if (Object.hasOwn(source, 'disabled')) {
      if (typeof source.disabled !== 'boolean')
        throw new Error('Native field option disabled flag is invalid.');
      option.disabled = source.disabled;
    }
    return option;
  });
}

function parseField(item: JsonValue): NativeRecordField {
  const source = jsonObject(item, 'Native field');
  approvedKeys(source, FIELD_KEYS, 'Native field');
  const key = safeKey(source.key, 'Native field key');
  if (typeof source.kind !== 'string' || !FIELD_KINDS.has(source.kind))
    throw new Error(`Native field ${key} kind is not supported.`);
  const field: NativeRecordField = {
    key,
    label: boundedText(source.label, 'Native field label', 160),
    kind: source.kind as FieldKind,
  };
  for (const flag of ['required', 'readOnly'] as const) {
    if (!Object.hasOwn(source, flag)) continue;
    const value = source[flag];
    if (typeof value !== 'boolean') throw new Error(`Native field ${key} ${flag} is invalid.`);
    field[flag] = value;
  }
  if (Object.hasOwn(source, 'help'))
    field.help = boundedText(source.help, 'Native field help', GENUX_LIMITS.text);
  if (Object.hasOwn(source, 'section'))
    field.section = boundedText(source.section, 'Native field section', 160);
  if (Object.hasOwn(source, 'precision')) {
    const precision = source.precision;
    // Bounds match safeDecimal in data/field-kit.
    if (
      typeof precision !== 'number' ||
      !Number.isInteger(precision) ||
      precision < 0 ||
      precision > 6
    )
      throw new Error(`Native field ${key} precision is invalid.`);
    field.precision = precision;
  }
  if (Object.hasOwn(source, 'currency')) {
    if (typeof source.currency !== 'string' || !/^[A-Z]{3}$/.test(source.currency))
      throw new Error(`Native field ${key} currency is invalid.`);
    field.currency = source.currency;
  }
  if (Object.hasOwn(source, 'unit')) field.unit = boundedText(source.unit, 'Native field unit', 32);
  if (Object.hasOwn(source, 'timezone')) {
    const timezone = boundedText(source.timezone, 'Native field timezone', 64);
    if (!validTimezone(timezone)) throw new Error(`Native field ${key} timezone is invalid.`);
    field.timezone = timezone;
  }
  if (Object.hasOwn(source, 'options')) field.options = parseOptions(source.options);
  return field;
}

/** Accept 1–24 exact declarative fields with unique safe keys and no callbacks. */
export function parseNativeFields(input: unknown): NativeRecordField[] {
  assertPlainJSON(input);
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_FIELDS)
    throw new Error(`Native fields must list 1 to ${MAX_FIELDS} fields.`);
  const keys = new Set<string>();
  return input.map(item => {
    const field = parseField(item);
    if (keys.has(field.key)) throw new Error(`Native field ${field.key} is duplicated.`);
    keys.add(field.key);
    return field;
  });
}

/**
 * Accept records holding only `id` plus declared keys with finite scalar values.
 * Empty draft values are preserved for field-kit validation; nothing is invented.
 */
export function parseNativeRecords(
  input: unknown,
  fields: readonly NativeRecordField[],
  max = DEFAULT_MAX_RECORDS,
): NativeRecord[] {
  if (!Number.isSafeInteger(max) || max < 1 || max > MAX_RECORDS)
    throw new Error('Native record limit is invalid.');
  const declared = new Set(fields.map(field => safeKey(field.key, 'Native field key')));
  assertPlainJSON(input);
  if (!Array.isArray(input) || input.length > max)
    throw new Error(`Native records must list at most ${max} records.`);
  const ids = new Set<string>();
  return input.map(item => {
    const source = jsonObject(item, 'Native record');
    const record: Record<string, FieldScalar> = {};
    for (const key of Object.keys(source)) {
      if (key !== 'id' && !declared.has(key))
        throw new Error(`Native record property ${key} is not declared.`);
      const value = source[key];
      if (!isScalar(value)) throw new Error(`Native record value ${key} must be a scalar.`);
      record[key] = value;
    }
    const id = record.id;
    assertId(id, 'Native record ID');
    if (ids.has(id)) throw new Error(`Native record ${id} is duplicated.`);
    ids.add(id);
    return Object.freeze(record) as NativeRecord;
  });
}

/**
 * Build trusted FieldDefinitions. getValue reads a fixed own data property without
 * invoking accessors; setValue returns a new frozen record and exists only for
 * editable, non-readOnly, non-id fields.
 */
export function nativeFieldDefinitions(
  fields: readonly NativeRecordField[],
  editable = false,
): FieldDefinition<NativeRecord>[] {
  return parseNativeFields(fields).map(({ readOnly, options, ...metadata }) => {
    const { key } = metadata;
    const getValue = (record: NativeRecord): FieldScalar => {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      return descriptor && 'value' in descriptor && isScalar(descriptor.value)
        ? descriptor.value
        : null;
    };
    const setValue = (record: NativeRecord, value: FieldScalar): NativeRecord => {
      if (!isScalar(value)) throw new Error(`Native field ${key} value must be a scalar.`);
      return Object.freeze({ ...record, [key]: value });
    };
    return Object.freeze({
      ...metadata,
      ...(options
        ? { options: Object.freeze(options.map(option => Object.freeze({ ...option }))) }
        : {}),
      getValue,
      ...(editable && !readOnly && key !== 'id' ? { setValue } : {}),
    });
  });
}
