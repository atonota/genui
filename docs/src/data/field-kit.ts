import { normalizeSearch } from '../i18n';
import { formatDateValue, formatNumericValue, scalarCollator } from './value-format';
import type {
  FieldAvailability,
  FieldDefinition,
  FieldErrors,
  FieldScalar,
  QueryState,
  RecordIdentity,
} from '../react/workspace/kit/contracts';

const textOperators = ['contains', 'eq', 'neq', 'is-empty', 'is-not-empty'] as const;
const numericOperators = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'is-empty',
  'is-not-empty',
] as const;
const choiceOperators = ['eq', 'neq', 'is-empty', 'is-not-empty'] as const;

export type FieldValueMetadata<R extends RecordIdentity = RecordIdentity> = Pick<
  FieldDefinition<R>,
  'kind' | 'precision' | 'currency' | 'unit' | 'timezone' | 'options'
>;
export type FieldPresentation = Readonly<{
  state: 'value' | 'empty' | 'invalid' | FieldAvailability['state'];
  text: string;
  messageKey?: string;
  reason?: string;
}>;
type PresentationOptions<R extends RecordIdentity> = Readonly<{
  record?: R;
  locale?: string;
  translate?: (key: string) => string;
}>;

/** Entity names are caller data; descriptions are phrase keys, IDs disambiguate duplicates. */
export function entityOptionLabel(
  option: Readonly<{ id?: string; value?: string; label: string; description?: string }>,
  translate: (key: string) => string = key => key,
): string {
  const identity = option.id ?? option.value;
  return `${option.label}${option.description ? ` — ${translate(option.description)}` : ''}${identity ? ` · ${identity}` : ''}`;
}

export function presentScalarValue<R extends RecordIdentity = RecordIdentity>(
  value: FieldScalar,
  field: FieldValueMetadata<R>,
  { record, locale = 'en', translate = key => key }: PresentationOptions<R> = {},
): FieldPresentation {
  const message = (state: 'empty' | 'invalid', key: string): FieldPresentation => ({
    state,
    text: translate(key),
    messageKey: key,
  });
  const invalid = (key: string) => ({
    ...message('invalid', 'Invalid value'),
    reason: translate(key),
  });
  if (isEmptyFieldValue(value)) return message('empty', 'Not set');
  if (typeof value === 'boolean' && (field.kind === 'boolean' || field.kind === 'text'))
    return { state: 'value', text: translate(value ? 'Yes' : 'No') };
  if (field.kind === 'boolean') return invalid('Choose Yes or No.');
  const option = field.options?.find(option => option.value === value);
  if (option)
    return {
      state: 'value',
      text:
        field.kind === 'entity' ? entityOptionLabel(option, translate) : translate(option.label),
    };
  if ((field.kind === 'choice' || field.kind === 'entity') && field.options)
    return invalid('Choose an available option.');
  if (field.kind === 'date') {
    if (typeof value !== 'string' || !validDateOnly(value))
      return invalid('Enter a valid date in YYYY-MM-DD format.');
    return {
      state: 'value',
      text: formatDateValue(new Date(`${value}T00:00:00.000Z`), locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }),
    };
  }
  if (field.kind === 'datetime') {
    if (typeof value !== 'string' || !validInstant(value))
      return invalid('Enter an ISO 8601 instant with Z or an explicit offset.');
    try {
      const zone = field.timezone ?? 'UTC';
      if (zone === 'date-only') return invalid('Use a real timezone for an instant.');
      return {
        state: 'value',
        text:
          formatDateValue(new Date(value), locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: zone,
          }) + ` · ${zone}`,
      };
    } catch {
      return invalid('The supplied timezone is invalid.');
    }
  }
  if (['number', 'money', 'unit', 'duration'].includes(field.kind)) {
    const precision = field.precision ?? (field.kind === 'number' ? 6 : 2);
    if (typeof value !== 'number' || !safeDecimal(value, precision))
      return invalid('Enter a finite number with the supported precision.');
    const resolve = (definition: string | ((record: R) => string) | undefined) =>
      typeof definition === 'function' ? (record ? definition(record) : undefined) : definition;
    const currency = resolve(field.currency),
      unit = resolve(field.unit);
    if (field.kind === 'money' && (!currency || !/^[A-Z]{3}$/.test(currency)))
      return invalid('A valid currency code is required for money.');
    if ((field.kind === 'unit' || field.kind === 'duration') && !unit?.trim())
      return invalid('A unit is required for this value.');
    if (field.kind === 'duration') {
      const factors: Readonly<Record<string, number>> = {
        ms: 0.001,
        millisecond: 0.001,
        milliseconds: 0.001,
        s: 1,
        second: 1,
        seconds: 1,
        min: 60,
        minute: 60,
        minutes: 60,
        h: 3600,
        hour: 3600,
        hours: 3600,
        day: 86400,
        days: 86400,
      };
      const factor = factors[unit!.toLowerCase()];
      if (factor === undefined || value < 0)
        return invalid('Use a nonnegative duration with a supported time unit.');
      const milliseconds = Math.round(value * factor * 1000);
      if (!Number.isSafeInteger(milliseconds))
        return invalid('The duration exceeds the supported numeric range.');
      const seconds = milliseconds / 1000;
      const hours = Math.floor(seconds / 3600),
        minutes = Math.floor((seconds % 3600) / 60),
        remainder = seconds % 60;
      const number = (value: number) =>
        formatNumericValue(value, locale, { maximumFractionDigits: 3 });
      const pieces = [
        hours ? `${number(hours)} ${translate('h')}` : '',
        minutes ? `${number(minutes)} ${translate('min')}` : '',
        remainder || (!hours && !minutes) ? `${number(remainder)} ${translate('s')}` : '',
      ].filter(Boolean);
      return { state: 'value', text: pieces.join(' ') };
    }
    try {
      const number = formatNumericValue(value, locale, {
        ...(field.kind === 'money' ? { style: 'currency' as const, currency } : {}),
        minimumFractionDigits: field.kind === 'money' ? precision : 0,
        maximumFractionDigits: precision,
      });
      return {
        state: 'value',
        text: field.kind === 'unit' ? `${number} ${translate(unit!)}` : number,
      };
    } catch {
      return invalid('The number format is not configured correctly.');
    }
  }
  return { state: 'value', text: String(value) };
}

export function presentFieldValue<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
  locale = 'en',
  translate: (key: string) => string = key => key,
): FieldPresentation {
  const availability = fieldAvailability(record, field);
  if (availability.state !== 'available') {
    const labels = {
      restricted: 'Restricted',
      unavailable: 'Unavailable',
      'not-applicable': 'Not applicable',
      unknown: 'Unknown',
    } as const;
    const key = labels[availability.state];
    return {
      state: availability.state,
      text: translate(key),
      messageKey: key,
      reason: availability.reason ? translate(availability.reason) : undefined,
    };
  }
  return presentScalarValue(field.getValue(record), field, { record, locale, translate });
}

/** Copy data descriptors recursively; accessor descriptors are retained without invoking them. */
export function cloneRecord<T>(value: T, seen = new WeakMap<object, object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value);
  if (existing) return existing as T;
  if (value instanceof Date) {
    const result = new Date(value.getTime());
    seen.set(value, result);
    return result as T;
  }
  if (value instanceof Map) {
    const result = new Map();
    seen.set(value, result);
    for (const [key, item] of value) result.set(cloneRecord(key, seen), cloneRecord(item, seen));
    return result as T;
  }
  if (value instanceof Set) {
    const result = new Set();
    seen.set(value, result);
    for (const item of value) result.add(cloneRecord(item, seen));
    return result as T;
  }
  const prototype = Object.getPrototypeOf(value);
  // Opaque instances have private slots that Object.create cannot reproduce.
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  const result = Array.isArray(value) ? [] : Object.create(prototype);
  seen.set(value, result);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if ('value' in descriptor) descriptor.value = cloneRecord(descriptor.value, seen);
    Object.defineProperty(result, key, descriptor);
  }
  return result as T;
}

/** Equality inspects descriptors, so dirty/stale checks cannot execute protected getters. */
export function recordsEqual(
  a: unknown,
  b: unknown,
  seen = new WeakMap<object, object>(),
): boolean {
  if (Object.is(a, b)) return true;
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)
  )
    return false;
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map)
    return (
      a.size === b.size &&
      [...a].every(
        ([key, value], index) =>
          recordsEqual(key, [...b][index]?.[0], seen) &&
          recordsEqual(value, [...b][index]?.[1], seen),
      )
    );
  if (a instanceof Set && b instanceof Set)
    return (
      a.size === b.size && [...a].every((value, index) => recordsEqual(value, [...b][index], seen))
    );
  const prototype = Object.getPrototypeOf(a);
  if (!Array.isArray(a) && prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(a);
  if (keys.length !== Reflect.ownKeys(b).length) return false;
  return keys.every(key => {
    const x = Object.getOwnPropertyDescriptor(a, key),
      y = Object.getOwnPropertyDescriptor(b, key);
    return (
      !!x &&
      !!y &&
      x.get === y.get &&
      x.set === y.set &&
      'value' in x === 'value' in y &&
      (!('value' in x) || recordsEqual(x.value, y.value, seen))
    );
  });
}

export function fieldAvailability<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
): FieldAvailability {
  return field.availability?.(record) ?? { state: 'available' };
}
/** A draft may strengthen supplied restrictions, but cannot weaken its original record. */
export function protectedDraftFields<R extends RecordIdentity>(
  original: R,
  fields: readonly FieldDefinition<R>[],
): readonly FieldDefinition<R>[] {
  return fields.map(field => {
    const originalAvailability = fieldAvailability(original, field);
    const originalEditability =
      originalAvailability.state === 'available' ? field.editable?.(original) : undefined;
    return {
      ...field,
      availability: (draft: R) =>
        originalAvailability.state !== 'available'
          ? originalAvailability
          : fieldAvailability(draft, field),
      editable: (draft: R) =>
        originalEditability?.allowed === false
          ? originalEditability
          : (field.editable?.(draft) ?? { allowed: true }),
    };
  });
}

/** Rebuild schema-authorized writes on the original; never copy draft access metadata wholesale. */
export function setDraftFieldValue<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
  value: FieldScalar,
): R {
  if (
    !field.setValue ||
    fieldAvailability(record, field).state !== 'available' ||
    field.editable?.(record).allowed === false
  )
    return record;
  const input = Object.create(Object.getPrototypeOf(record));
  const retained: [PropertyKey, PropertyDescriptor][] = [];
  for (const key of Reflect.ownKeys(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key)!;
    Object.defineProperty(
      input,
      key,
      'value' in descriptor ? descriptor : { ...descriptor, enumerable: false },
    );
    if (!('value' in descriptor) || !descriptor.enumerable) retained.push([key, descriptor]);
  }
  const next = field.setValue(input as R, value);
  const restored = Object.create(Object.getPrototypeOf(next));
  Object.defineProperties(restored, Object.getOwnPropertyDescriptors(next));
  for (const [key, descriptor] of retained)
    if (!Object.hasOwn(restored, key)) Object.defineProperty(restored, key, descriptor);
  return restored as R;
}

export function authorizedRecordDraft<R extends RecordIdentity>(
  original: R,
  draft: R,
  fields: readonly FieldDefinition<R>[],
): R {
  let approved = cloneRecord(original);
  for (const field of protectedDraftFields(original, fields)) {
    if (
      !field.setValue ||
      fieldAvailability(draft, field).state !== 'available' ||
      field.editable?.(draft).allowed === false
    )
      continue;
    const value = field.getValue(draft);
    approved = setDraftFieldValue(approved, field, value);
  }
  return approved;
}

export function isEmptyFieldValue(value: FieldScalar): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}
export function fieldFilterOperators<R extends RecordIdentity>(field: FieldDefinition<R>) {
  if (field.filterOperators) return field.filterOperators;
  if (['number', 'money', 'unit', 'duration', 'date', 'datetime'].includes(field.kind))
    return numericOperators;
  if (field.kind === 'choice' || field.kind === 'boolean') return choiceOperators;
  return textOperators;
}
export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validInstant(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !validDateOnly(value.slice(0, 10))
  )
    return false;
  return Number.isFinite(Date.parse(value));
}
export function validateDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  if (!validDateOnly(start) || !validDateOnly(end)) return 'Enter valid start and end dates.';
  return start > end ? 'End date must be on or after the start date.' : null;
}
export function safeDecimal(value: number, precision = 2): boolean {
  if (!Number.isFinite(value) || !Number.isInteger(precision) || precision < 0 || precision > 6)
    return false;
  const scaled = value * 10 ** precision;
  return (
    Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) <= 0.000001
  );
}
export function validateFieldValue<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
  value: FieldScalar,
): string | null {
  const availability = fieldAvailability(record, field);
  if (availability.state !== 'available')
    return field.required
      ? (availability.reason ?? 'A required field is not available for editing.')
      : null;
  if (field.required && isEmptyFieldValue(value))
    return !field.setValue || field.editable?.(record).allowed === false
      ? (field.editable?.(record).reason ?? 'A required field is read-only.')
      : 'This field is required.';
  if (!isEmptyFieldValue(value)) {
    if (
      ['number', 'money', 'unit', 'duration'].includes(field.kind) &&
      (typeof value !== 'number' ||
        !safeDecimal(value, field.precision ?? (field.kind === 'number' ? 6 : 2)))
    )
      return 'Enter a finite number with the supported precision.';
    if (field.kind === 'date' && (typeof value !== 'string' || !validDateOnly(value)))
      return 'Enter a valid date in YYYY-MM-DD format.';
    if (field.kind === 'datetime' && (typeof value !== 'string' || !validInstant(value)))
      return 'Enter an ISO 8601 instant with Z or an explicit offset.';
    if (field.kind === 'boolean' && typeof value !== 'boolean') return 'Choose Yes or No.';
    if (
      (field.kind === 'choice' || field.kind === 'entity') &&
      field.options &&
      !field.options.some(option => option.value === value && !option.disabled)
    )
      return 'Choose an available option.';
  }
  return field.validate?.(value, record) ?? null;
}
export function validateRecord<R extends RecordIdentity>(
  record: R,
  fields: readonly FieldDefinition<R>[],
): FieldErrors {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateFieldValue(
      record,
      field,
      fieldAvailability(record, field).state === 'available' ? field.getValue(record) : null,
    );
    if (error) errors[field.key] = error;
  }
  return errors;
}
export function applyFieldValue<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
  value: FieldScalar,
): R {
  if (
    !field.setValue ||
    fieldAvailability(record, field).state !== 'available' ||
    field.editable?.(record).allowed === false
  )
    return record;
  const error = validateFieldValue(record, { ...field, required: false }, value);
  if (error) return record;
  return field.setValue(record, value);
}
/** Compatibility API: callers that only need a string can keep their existing import. */
export function formatFieldValue<R extends RecordIdentity>(
  record: R,
  field: FieldDefinition<R>,
  locale = 'en',
): string {
  const presentation = presentFieldValue(record, field, locale);
  if (presentation.state === 'invalid')
    return field.kind === 'date' || field.kind === 'datetime' ? 'Unknown' : 'Unavailable';
  if (field.kind === 'duration' && presentation.state === 'value') {
    const unit = typeof field.unit === 'function' ? field.unit(record) : field.unit;
    return `${formatNumericValue(field.getValue(record) as number, locale, { maximumFractionDigits: field.precision ?? 6 })}${unit ? ` ${unit}` : ''}`;
  }
  if (field.kind === 'entity' && fieldAvailability(record, field).state === 'available') {
    const option = field.options?.find(option => option.value === field.getValue(record));
    if (option)
      return option.description ? `${option.label} — ${option.description}` : option.label;
  }
  return presentation.text;
}
const normalized = normalizeSearch;
export function queryKitRecords<R extends RecordIdentity>(
  records: readonly R[],
  fields: readonly FieldDefinition<R>[],
  query: QueryState,
  locale = 'en',
): R[] {
  const search = normalized(query.search);
  const filtered = records.filter(record => {
    const available = fields.filter(
      field => fieldAvailability(record, field).state === 'available',
    );
    if (
      search &&
      !available.some(field => normalized(String(field.getValue(record) ?? '')).includes(search))
    )
      return false;
    return query.filters.every(filter => {
      const field = available.find(value => value.key === filter.fieldKey);
      if (!field || !fieldFilterOperators(field).includes(filter.operator)) return false;
      const value = field.getValue(record),
        target = filter.value ?? null;
      if (filter.operator === 'is-empty') return isEmptyFieldValue(value);
      if (filter.operator === 'is-not-empty') return !isEmptyFieldValue(value);
      if (filter.operator === 'contains')
        return (
          typeof value === 'string' &&
          typeof target === 'string' &&
          normalized(value).includes(normalized(target))
        );
      if (
        field.kind === 'datetime' &&
        typeof value === 'string' &&
        typeof target === 'string' &&
        validInstant(value) &&
        validInstant(target)
      ) {
        if (filter.operator === 'eq') return Date.parse(value) === Date.parse(target);
        if (filter.operator === 'neq') return Date.parse(value) !== Date.parse(target);
      }
      if (filter.operator === 'eq') return value === target;
      if (filter.operator === 'neq') return value !== target;
      if (value === null || target === null || typeof value !== typeof target) return false;
      if (typeof value !== 'number' && typeof value !== 'string') return false;
      if (typeof target !== 'number' && typeof target !== 'string') return false;
      const comparison =
        field.kind === 'datetime' && typeof value === 'string' && typeof target === 'string'
          ? Date.parse(value) - Date.parse(target)
          : typeof value === 'number' && typeof target === 'number'
            ? value - target
            : String(value).localeCompare(String(target));
      return filter.operator === 'gt'
        ? comparison > 0
        : filter.operator === 'gte'
          ? comparison >= 0
          : filter.operator === 'lt'
            ? comparison < 0
            : comparison <= 0;
    });
  });
  const collator = scalarCollator(locale);
  return [...filtered].sort((a, b) => {
    for (const clause of query.sort) {
      const field = fields.find(value => value.key === clause.fieldKey);
      if (!field) continue;
      const x = fieldAvailability(a, field).state === 'available' ? field.getValue(a) : null;
      const y = fieldAvailability(b, field).state === 'available' ? field.getValue(b) : null;
      if (x === null || y === null) {
        if (x !== y) return x === null ? 1 : -1;
        continue;
      }
      const compared =
        field.kind === 'datetime' && typeof x === 'string' && typeof y === 'string'
          ? Date.parse(x) - Date.parse(y)
          : typeof x === 'number' && typeof y === 'number'
            ? x - y
            : collator.compare(String(x), String(y));
      if (compared) return clause.direction === 'asc' ? compared : -compared;
    }
    return collator.compare(a.id, b.id);
  });
}
