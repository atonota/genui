import { validateDateTimeModel, type DateTimeModel } from '../../data/date-time-model';
import type { JsonValue } from '../contracts';
import type { NativeDefinition, NativePayload } from '../native-contract';

/** Presets, cell notes and confirmation stay with the single picker; variant is fixed to filled. */
const unsupported = ['presets', 'cellNotes', 'needConfirm'] as const;

/** Validate with the shared date-time model, then narrow to multiple calendar dates. */
function parse(input: unknown): NativePayload {
  const model: DateTimeModel = validateDateTimeModel(input);
  if (model.kind !== 'date' || model.multiple !== true)
    throw new Error('GenUXDateTimeMultiple requires kind date with multiple true.');
  for (const key of unsupported)
    if (Object.hasOwn(model, key))
      throw new Error(`GenUXDateTimeMultiple property ${key} is not approved.`);
  if (model.variant !== undefined && model.variant !== 'filled')
    throw new Error('GenUXDateTimeMultiple variant must be filled.');
  return model as unknown as NativePayload;
}

/** Canonical value: unique dates in chronological order; an empty selection is `null`. */
export function canonicalDates(dates: readonly string[]): string[] | null {
  // Canonical fixed-width text orders chronologically.
  const unique = [...new Set(dates)].sort();
  return unique.length ? unique : null;
}

/** Whether one date may be published, judged by the shared model validator itself. */
export function dateSelectable(data: NativePayload, date: string): boolean {
  try {
    validateDateTimeModel({ ...data, value: [date] });
    return true;
  } catch {
    return false;
  }
}

export const definition: NativeDefinition = {
  name: 'GenUXDateTimeMultiple',
  readOnly: false,
  parse,
  withValue(data: NativePayload, value: JsonValue): NativePayload {
    if (data.readOnly === true || data.disabled === true)
      throw new Error('GenUXDateTimeMultiple is not editable.');
    if (value !== null && !(Array.isArray(value) && value.every(item => typeof item === 'string')))
      throw new Error('GenUXDateTimeMultiple value must be a date list or null.');
    return parse({ ...data, value: value === null ? null : canonicalDates(value as string[]) });
  },
};

export const sample: NativePayload = {
  kind: 'date',
  multiple: true,
  label: 'Review days',
  value: ['2026-10-05', '2026-10-20'],
  minDate: '2026-10-01',
  maxDate: '2026-12-31',
  disabledWeekdays: [0, 6],
  help: 'Choose every weekday the review panel meets.',
};
