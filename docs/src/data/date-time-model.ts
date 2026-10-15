import { assertPlainJSON, GENUI_LIMITS } from '../genui/native-contract';

/**
 * Serializable model for the Atlas date and time family.
 *
 * Dates are `YYYY-MM-DD`, times are `HH:mm:ss` and date-times are `YYYY-MM-DDTHH:mm:ss`.
 * Times and date-times are explicit local wall times: they carry no offset, are never
 * converted to UTC and are not globally unique instants. The host resolves the time zone
 * and any DST gap or overlap. Validation is calendar arithmetic only and never reads the
 * system clock.
 */
export const DATE_TIME_KINDS = [
  'date',
  'time',
  'datetime',
  'date-range',
  'time-range',
  'datetime-range',
] as const;
export type DateTimeKind = (typeof DATE_TIME_KINDS)[number];
export const DATE_UNITS = ['date', 'week', 'month', 'quarter', 'year'] as const;
export type DateUnit = (typeof DATE_UNITS)[number];
export const DATE_TIME_MINUTE_STEPS = [1, 5, 10, 15, 30] as const;
export const DATE_TIME_VARIANTS = ['filled', 'outlined', 'borderless', 'underlined'] as const;
export const DATE_TIME_STATUSES = ['error', 'warning'] as const;
/** `null` is the only empty state; ranges are complete ordered pairs. */
export type DateTimeValue = string | null | readonly string[];

export const DATE_TIME_LIMITS = Object.freeze({
  multiple: 64,
  disabledDates: 366,
  presets: 12,
  cellNotes: 62,
});

export interface DateTimePreset {
  readonly label: string;
  readonly value: DateTimeValue;
}
export interface DateTimeCellNote {
  readonly date: string;
  readonly label: string;
}
export interface DateTimeModel {
  readonly kind: DateTimeKind;
  readonly label: string;
  readonly value: DateTimeValue;
  /** Selection precision for `date` and `date-range`; defaults to `date`. */
  readonly unit?: DateUnit;
  /** Multiple unique dates; `date` kind only. */
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly status?: (typeof DATE_TIME_STATUSES)[number];
  readonly help?: string;
  readonly error?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly disabledDates?: readonly string[];
  /** 0 is Sunday through 6 Saturday. */
  readonly disabledWeekdays?: readonly number[];
  readonly minuteStep?: (typeof DATE_TIME_MINUTE_STEPS)[number];
  readonly use12Hours?: boolean;
  readonly needConfirm?: boolean;
  readonly showSeconds?: boolean;
  readonly variant?: (typeof DATE_TIME_VARIANTS)[number];
  readonly presets?: readonly DateTimePreset[];
  readonly cellNotes?: readonly DateTimeCellNote[];
}

interface Day {
  year: number;
  month: number;
  day: number;
}
interface Context {
  base: 'date' | 'time' | 'datetime';
  range: boolean;
  multiple: boolean;
  unit: DateUnit;
  min?: number;
  max?: number;
  disabledDates: ReadonlySet<number>;
  disabledWeekdays: ReadonlySet<number>;
  minuteStep?: number;
  showSeconds?: boolean;
}

const modelKeys = new Set([
  'kind',
  'label',
  'value',
  'unit',
  'multiple',
  'disabled',
  'readOnly',
  'required',
  'status',
  'help',
  'error',
  'minDate',
  'maxDate',
  'disabledDates',
  'disabledWeekdays',
  'minuteStep',
  'use12Hours',
  'needConfirm',
  'showSeconds',
  'variant',
  'presets',
  'cellNotes',
]);
const calendarKinds: readonly DateTimeKind[] = ['date', 'datetime', 'date-range', 'datetime-range'];
const timedKinds: readonly DateTimeKind[] = ['time', 'datetime', 'time-range', 'datetime-range'];
const unitKinds: readonly DateTimeKind[] = ['date', 'date-range'];

const fail = (path: string, expected: string): never => {
  throw new Error(`${path}: expected ${expected}.`);
};
const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'object');
  return value as Record<string, unknown>;
};
const exactKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void => {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) fail(`${path}.${key}`, 'no property');
};
const text = (value: unknown, path: string): void => {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'non-empty text');
};
const bool = (value: unknown, path: string): void => {
  if (typeof value !== 'boolean') fail(path, 'boolean');
};
const oneOf = <T>(value: unknown, values: readonly T[], path: string): T => {
  if (!values.includes(value as T)) fail(path, values.join(' | '));
  return value as T;
};
const list = (value: unknown, max: number, path: string): readonly unknown[] => {
  if (!Array.isArray(value) || value.length > max) fail(path, `array up to ${max}`);
  return value as readonly unknown[];
};
const arrayIndex = /^(0|[1-9]\d*)$/;
/**
 * JSON keeps only enumerable own data, turns array holes into `null` and drops array keys
 * that are not in-bounds indices. Reject anything serialization would drop or change,
 * reading descriptors only so getters never run.
 * Runs after `assertPlainJSON`, which already bounds size and rejects cycles and accessors.
 */
function assertSerializable(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') return;
  const array = Array.isArray(value);
  const length = Array.isArray(value) ? value.length : 0;
  for (let index = 0; index < length; index++)
    if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'no array hole');
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    const at = array ? `${path}[${String(key)}]` : `${path}.${String(key)}`;
    if (array && (typeof key !== 'string' || !arrayIndex.test(key) || Number(key) >= length))
      fail(at, 'array index');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !('value' in descriptor)) fail(at, 'enumerable data property');
    assertSerializable(descriptor.value, at);
  }
}
/**
 * `assertPlainJSON` ends with `JSON.stringify`, which would run an inherited `toJSON` on an
 * Array subclass. Reject foreign array prototypes first, reading descriptors only. Accounting
 * mirrors the shared guard: every visited value counts, and the visit, depth, array length and
 * key bounds stop the walk before any enumeration, so this pass never outruns the guard. Cycles
 * and accessors are still left to it.
 */
function assertArrayPrototypes(input: unknown): void {
  let visits = 0;
  const active = new WeakSet<object>();
  const visit = (value: unknown, path: string, depth: number): void => {
    if (++visits > 6000 || depth > GENUI_LIMITS.depth) fail(path, 'bounded JSON complexity');
    if (!value || typeof value !== 'object' || active.has(value)) return;
    const array = Array.isArray(value);
    if (array && Object.getPrototypeOf(value) !== Array.prototype) fail(path, 'plain array');
    if (array && (value as unknown[]).length > 256) fail(path, 'array up to 256 entries');
    const keys = Reflect.ownKeys(value);
    if (keys.length > 256) fail(path, 'up to 256 keys');
    active.add(value);
    for (const key of keys) {
      if ((array && key === 'length') || typeof key !== 'string') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if ('value' in descriptor)
        visit(descriptor.value, array ? `${path}[${key}]` : `${path}.${key}`, depth + 1);
    }
    active.delete(value);
  };
  visit(input, 'model', 0);
}

const leapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year: number, month: number) =>
  month === 2 ? (leapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

function parseDay(value: unknown): Day | undefined {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    return undefined;
  return { year, month, day };
}
function parseTime(value: string): { minute: number; second: number } | undefined {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [hour, minute, second] = match.slice(1).map(Number);
  return hour < 24 && minute < 60 && second < 60 ? { minute, second } : undefined;
}
/** Days since 1970-01-01 in the proleptic Gregorian calendar, without `Date`. */
function dayNumber({ year, month, day }: Day): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}
/** 0 is Sunday; 1970-01-01 was a Thursday. */
const weekday = (day: Day) => (((dayNumber(day) + 4) % 7) + 7) % 7;
const requireDay = (value: unknown, path: string): Day =>
  parseDay(value) ?? fail(path, 'calendar date YYYY-MM-DD');

function isAnchor(day: Day, unit: DateUnit): boolean {
  if (unit === 'week') return weekday(day) === 1;
  if (unit === 'month') return day.day === 1;
  if (unit === 'quarter') return day.day === 1 && (day.month - 1) % 3 === 0;
  if (unit === 'year') return day.month === 1 && day.day === 1;
  return true;
}

function checkPoint(value: unknown, path: string, context: Context): string {
  if (typeof value !== 'string') return fail(path, `${context.base} text`);
  let dayText: string | undefined;
  let timeText: string | undefined;
  if (context.base === 'date') dayText = value;
  else if (context.base === 'time') timeText = value;
  else {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/.exec(value);
    if (!match) fail(path, 'local date-time YYYY-MM-DDTHH:mm:ss');
    [dayText, timeText] = [match![1], match![2]];
  }
  if (dayText !== undefined) {
    const day = requireDay(dayText, path);
    if (!isAnchor(day, context.unit)) fail(path, `${context.unit} anchor`);
    // Bounds and restrictions judge the published anchor only, never period overlap.
    const start = dayNumber(day);
    if (context.min !== undefined && start < context.min) fail(path, 'value on or after minDate');
    if (context.max !== undefined && start > context.max) fail(path, 'value on or before maxDate');
    if (context.disabledDates.has(start)) fail(path, 'available date');
    if (context.disabledWeekdays.has(weekday(day))) fail(path, 'available weekday');
  }
  if (timeText !== undefined) {
    const time = parseTime(timeText) ?? fail(path, 'wall time HH:mm:ss');
    if (context.minuteStep && time.minute % context.minuteStep !== 0)
      fail(path, `minute in steps of ${context.minuteStep}`);
    if (context.showSeconds === false && time.second !== 0) fail(path, 'zero seconds');
  }
  return value;
}

function checkValue(value: unknown, path: string, context: Context): void {
  if (value === null) return;
  if (context.range) {
    const pair = list(value, 2, path);
    if (pair.length !== 2) fail(path, 'complete pair or null');
    const [start, end] = pair.map((item, index) => checkPoint(item, `${path}[${index}]`, context));
    // Canonical fixed-width text orders chronologically.
    if (start > end) fail(path, 'ordered range');
    return;
  }
  if (context.multiple) {
    const dates = list(value, DATE_TIME_LIMITS.multiple, path);
    if (!dates.length) fail(path, 'at least one date or null');
    const seen = new Set<string>();
    dates.forEach((item, index) => {
      const date = checkPoint(item, `${path}[${index}]`, context);
      if (seen.has(date)) fail(`${path}[${index}]`, 'unique date');
      seen.add(date);
    });
    return;
  }
  if (Array.isArray(value)) fail(path, 'single value');
  checkPoint(value, path, context);
}

const presetKeys = new Set(['label', 'value']);
const noteKeys = new Set(['date', 'label']);

/** Validate an untrusted JSON model. Throws instead of coercing; returns a detached copy. */
export function validateDateTimeModel(input: unknown): DateTimeModel {
  assertArrayPrototypes(input);
  assertPlainJSON(input);
  assertSerializable(input, 'model');
  const model = record(input, 'model');
  exactKeys(model, modelKeys, 'model');
  const has = (key: string) => Object.keys(model).includes(key);
  const kind = oneOf(model.kind, DATE_TIME_KINDS, 'model.kind');
  text(model.label, 'model.label');
  if (!has('value')) fail('model.value', 'value or null');
  const calendar = calendarKinds.includes(kind);
  const timed = timedKinds.includes(kind);
  const only = (key: string, allowed: boolean, why: string) => {
    if (has(key) && !allowed) fail(`model.${key}`, why);
  };

  only('unit', unitKinds.includes(kind), 'no unit outside date and date-range');
  const unit = has('unit') ? oneOf(model.unit, DATE_UNITS, 'model.unit') : 'date';
  for (const key of ['multiple', 'disabled', 'readOnly', 'required', 'needConfirm'])
    if (has(key)) bool(model[key], `model.${key}`);
  if (model.multiple === true && kind !== 'date') fail('model.multiple', 'date kind');
  for (const key of ['use12Hours', 'showSeconds', 'minuteStep'])
    only(key, timed, 'a time-bearing kind');
  for (const key of ['use12Hours', 'showSeconds']) if (has(key)) bool(model[key], `model.${key}`);
  if (has('minuteStep')) oneOf(model.minuteStep, DATE_TIME_MINUTE_STEPS, 'model.minuteStep');
  if (has('status')) oneOf(model.status, DATE_TIME_STATUSES, 'model.status');
  if (has('variant')) oneOf(model.variant, DATE_TIME_VARIANTS, 'model.variant');
  for (const key of ['help', 'error']) if (has(key)) text(model[key], `model.${key}`);

  // Bounds and restrictions apply at every unit to the published anchor.
  for (const key of ['minDate', 'maxDate', 'disabledDates', 'disabledWeekdays'])
    only(key, calendar, 'a calendar kind');
  // Day cell notes need day precision.
  only('cellNotes', calendar && unit === 'date', 'a calendar kind with day precision');
  const min = has('minDate') ? dayNumber(requireDay(model.minDate, 'model.minDate')) : undefined;
  const max = has('maxDate') ? dayNumber(requireDay(model.maxDate, 'model.maxDate')) : undefined;
  if (min !== undefined && max !== undefined && min > max)
    fail('model.maxDate', 'on or after minDate');
  const disabledDates = new Set<number>();
  if (has('disabledDates'))
    list(model.disabledDates, DATE_TIME_LIMITS.disabledDates, 'model.disabledDates').forEach(
      (item, index) => {
        const day = dayNumber(requireDay(item, `model.disabledDates[${index}]`));
        if (disabledDates.has(day)) fail(`model.disabledDates[${index}]`, 'unique date');
        disabledDates.add(day);
      },
    );
  const disabledWeekdays = new Set<number>();
  if (has('disabledWeekdays'))
    list(model.disabledWeekdays, 7, 'model.disabledWeekdays').forEach((item, index) => {
      const path = `model.disabledWeekdays[${index}]`;
      if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 6)
        fail(path, 'weekday 0..6');
      if (disabledWeekdays.has(item as number)) fail(path, 'unique weekday');
      disabledWeekdays.add(item as number);
    });
  if (has('cellNotes')) {
    const noted = new Set<number>();
    list(model.cellNotes, DATE_TIME_LIMITS.cellNotes, 'model.cellNotes').forEach((item, index) => {
      const path = `model.cellNotes[${index}]`;
      const note = record(item, path);
      exactKeys(note, noteKeys, path);
      const day = dayNumber(requireDay(note.date, `${path}.date`));
      text(note.label, `${path}.label`);
      if (noted.has(day)) fail(`${path}.date`, 'unique date');
      noted.add(day);
    });
  }

  const context: Context = {
    base: kind.startsWith('datetime') ? 'datetime' : kind.startsWith('time') ? 'time' : 'date',
    range: kind.endsWith('-range'),
    multiple: model.multiple === true,
    unit,
    min,
    max,
    disabledDates,
    disabledWeekdays,
    minuteStep: model.minuteStep as number | undefined,
    showSeconds: model.showSeconds as boolean | undefined,
  };
  if (has('presets'))
    list(model.presets, DATE_TIME_LIMITS.presets, 'model.presets').forEach((item, index) => {
      const path = `model.presets[${index}]`;
      const preset = record(item, path);
      exactKeys(preset, presetKeys, path);
      text(preset.label, `${path}.label`);
      if (preset.value === null) fail(`${path}.value`, 'a selectable value');
      checkValue(preset.value, `${path}.value`, context);
    });
  checkValue(model.value, 'model.value', context);
  return JSON.parse(JSON.stringify(model)) as DateTimeModel;
}
