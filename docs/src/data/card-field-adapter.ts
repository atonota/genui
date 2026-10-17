import { presentFieldValue } from './field-kit';
import type { GenUXCardModel } from './card-model';
import type {
  FieldAvailability,
  FieldDefinition,
  FieldKind,
  FieldOption,
  FieldScalar,
  RecordIdentity,
} from '../react/workspace/kit/contracts';

/** Data-only metadata. Functions, source code and paths are never descriptor values. */
export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  readOnly?: boolean;
  precision?: number;
  currency?: string;
  unit?: string;
  timezone?: string;
  options?: readonly FieldOption[];
  availability?: FieldAvailability;
}
const kinds: readonly FieldKind[] = [
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
];
const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
const availabilityStates = new Set([
  'available',
  'restricted',
  'unavailable',
  'not-applicable',
  'unknown',
]);
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function assertDataOnly(value: unknown, depth = 0, budget = { remaining: 4096 }): void {
  if (depth > 8 || --budget.remaining < 0)
    throw new Error('Field metadata exceeds its data limit.');
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return;
  if (typeof value !== 'object' || !value)
    throw new Error('Field metadata must contain serializable data only.');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    throw new Error('Field metadata must be a plain data object.');
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string'))
    throw new Error('Field metadata does not support symbol keys.');
  for (const [key, property] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!('value' in property))
      throw new Error('Field metadata cannot contain accessor properties.');
    assertDataOnly(property.value, depth + 1, budget);
  }
}

function phrase(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256)
    throw new Error(`Invalid field ${name}.`);
  return value;
}
function descriptor(value: unknown): FieldDescriptor {
  if (!isObject(value)) throw new Error('Invalid field descriptor.');
  const key = phrase(value.key, 'key');
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key) || blockedKeys.has(key))
    throw new Error('Invalid field key.');
  if (typeof value.kind !== 'string' || !kinds.includes(value.kind as FieldKind))
    throw new Error('Unsupported field kind.');
  const result: FieldDescriptor = {
    key,
    label: phrase(value.label, 'label'),
    kind: value.kind as FieldKind,
  };
  for (const name of ['required', 'readOnly'] as const) {
    if (value[name] !== undefined && typeof value[name] !== 'boolean')
      throw new Error(`Invalid field ${name}.`);
    if (typeof value[name] === 'boolean') result[name] = value[name];
  }
  if (value.precision !== undefined) {
    if (
      !Number.isInteger(value.precision) ||
      Number(value.precision) < 0 ||
      Number(value.precision) > 6
    )
      throw new Error('Invalid field precision.');
    result.precision = Number(value.precision);
  }
  for (const name of ['currency', 'unit', 'timezone'] as const)
    if (value[name] !== undefined) result[name] = phrase(value[name], name);
  if (result.currency && !/^[A-Z]{3}$/.test(result.currency))
    throw new Error('Invalid field currency.');
  if (result.kind === 'money' && !result.currency)
    throw new Error('Money fields require an explicit currency.');
  if (['unit', 'duration'].includes(result.kind) && !result.unit)
    throw new Error('This field requires a unit.');
  if (result.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: result.timezone });
    } catch {
      throw new Error('Invalid field timezone.');
    }
  }
  if (value.options !== undefined) {
    if (!Array.isArray(value.options) || value.options.length > 100)
      throw new Error('Invalid field options.');
    const used = new Set<string>();
    result.options = Array.from(value.options, option => {
      if (!isObject(option)) throw new Error('Invalid field option.');
      const optionValue = phrase(option.value, 'option value');
      if (used.has(optionValue)) throw new Error('Duplicate field option.');
      used.add(optionValue);
      return {
        value: optionValue,
        label: phrase(option.label, 'option label'),
        ...(option.disabled === true ? { disabled: true } : {}),
      };
    });
  }
  if (value.availability !== undefined) {
    if (
      !isObject(value.availability) ||
      typeof value.availability.state !== 'string' ||
      !availabilityStates.has(value.availability.state)
    )
      throw new Error('Invalid field availability.');
    result.availability = {
      state: value.availability.state as FieldAvailability['state'],
      ...(value.availability.reason === undefined
        ? {}
        : { reason: phrase(value.availability.reason, 'availability reason') }),
    };
  }
  return result;
}

/** Compile only direct, own scalar data. Availability is checked before property access. */
export function compileFieldDescriptors<R extends RecordIdentity>(
  input: unknown,
): readonly FieldDefinition<R>[] {
  assertDataOnly(input);
  if (!Array.isArray(input) || input.length > 64)
    throw new Error('Supply at most 64 field descriptors.');
  const used = new Set<string>();
  return Array.from(input, raw => {
    const field = descriptor(raw);
    if (used.has(field.key)) throw new Error('Duplicate field key.');
    used.add(field.key);
    const getValue = (record: R): FieldScalar => {
      if (field.availability && field.availability.state !== 'available') return null;
      const own = Object.getOwnPropertyDescriptor(record, field.key);
      // Accessor properties do not cross this serializable-data boundary.
      const value: unknown = own && 'value' in own ? own.value : null;
      return value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
        ? value
        : null;
    };
    return {
      key: field.key,
      label: field.label,
      kind: field.kind,
      required: field.required,
      precision: field.precision,
      currency: field.currency,
      unit: field.unit,
      timezone: field.timezone,
      options: field.options,
      getValue,
      ...(field.availability ? { availability: () => field.availability! } : {}),
      ...(!field.readOnly && (!field.availability || field.availability.state === 'available')
        ? {
            setValue: (record: R, value: FieldScalar): R => {
              const prototype = Object.getPrototypeOf(record);
              if (prototype !== Object.prototype && prototype !== null)
                throw new Error('Card field records must be plain data objects.');
              const properties: Record<string, PropertyDescriptor> =
                Object.getOwnPropertyDescriptors(record);
              properties[field.key] = {
                value,
                writable: true,
                enumerable: true,
                configurable: true,
              };
              return Object.create(prototype, properties) as R;
            },
          }
        : {}),
    };
  });
}

/** Native workspace fields remain trusted host code; guarded presentation precedes any getter. */
export function entityCardFromFields<R extends RecordIdentity>(
  record: R,
  fields: readonly FieldDefinition<R>[],
  {
    locale = 'en',
    translate = (key: string) => key,
  }: { locale?: string; translate?: (key: string) => string } = {},
): GenUXCardModel {
  return {
    id: record.id,
    kind: 'entity',
    title: record.id,
    facts: fields.map(field => {
      const shown = presentFieldValue(record, field, locale, translate);
      return {
        key: field.key,
        label: translate(field.label),
        value: shown.text + (shown.reason ? ` · ${shown.reason}` : ''),
      };
    }),
    primaryAction: {
      id: 'inspect',
      label: translate('Open {id}').replace('{id}', record.id),
      intent: 'inspect',
    },
  };
}

export interface FrappeCardAdaptation {
  doctype: string;
  fields: readonly FieldDescriptor[];
  unsupported: readonly { fieldname: string; reason: string }[];
}
/** Bounded fixture bridge, not a Frappe connection, permission resolver or server query. */
export function adaptFrappeDocType(input: unknown): FrappeCardAdaptation {
  assertDataOnly(input);
  if (!isObject(input) || !Array.isArray(input.fields) || input.fields.length > 64)
    throw new Error('Invalid bounded DocType metadata.');
  const doctype = phrase(input.name, 'DocType name');
  const fields: FieldDescriptor[] = [],
    unsupported: { fieldname: string; reason: string }[] = [];
  const mapped: Readonly<Record<string, FieldKind>> = {
    Data: 'text',
    'Small Text': 'multiline',
    Text: 'multiline',
    Int: 'number',
    Float: 'number',
    Percent: 'number',
    Currency: 'money',
    Date: 'date',
    Datetime: 'datetime',
    Duration: 'duration',
    Check: 'boolean',
    Select: 'choice',
    Link: 'entity',
  };
  for (const raw of input.fields) {
    if (!isObject(raw)) throw new Error('Invalid DocType field.');
    const key = phrase(raw.fieldname, 'key'),
      label = phrase(raw.label ?? raw.fieldname, 'label');
    if (raw.fieldtype === 'Section Break' || raw.fieldtype === 'Column Break') continue;
    const kind = typeof raw.fieldtype === 'string' ? mapped[raw.fieldtype] : undefined;
    if (!kind) {
      unsupported.push({
        fieldname: key,
        reason: 'This field type is outside the scalar card bridge.',
      });
      continue;
    }
    if (kind === 'money' && (typeof raw.options !== 'string' || !/^[A-Z]{3}$/.test(raw.options))) {
      unsupported.push({
        fieldname: key,
        reason: 'Supply a literal currency code; dynamic currency references need a host resolver.',
      });
      continue;
    }
    const field: FieldDescriptor = {
      key,
      label,
      kind,
      required: raw.reqd === 1,
      readOnly: raw.read_only === 1,
    };
    if (kind === 'money') field.currency = String(raw.options);
    if (kind === 'duration') field.unit = 's';
    if (raw.fieldtype === 'Int') field.precision = 0;
    if (kind === 'choice')
      field.options =
        typeof raw.options === 'string'
          ? raw.options
              .split('\n')
              .filter(Boolean)
              .map(value => ({ value, label: value }))
          : [];
    fields.push(descriptor(field));
  }
  // Reuse duplicate, scalar and size validation before returning serializable metadata.
  compileFieldDescriptors(fields);
  return { doctype, fields, unsupported };
}
export const FRAPPE_CARD_FIXTURE = {
  name: 'Sales review',
  fields: [
    { fieldname: 'customer', label: 'Customer', fieldtype: 'Data', reqd: 1 },
    { fieldname: 'amount', label: 'Amount', fieldtype: 'Currency', options: 'EUR' },
    {
      fieldname: 'stage',
      label: 'Stage',
      fieldtype: 'Select',
      options: 'Planned\nIn progress\nDone',
    },
    { fieldname: 'review_date', label: 'Review date', fieldtype: 'Date' },
  ],
} as const;
