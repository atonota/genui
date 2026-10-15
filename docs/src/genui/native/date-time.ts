import type { JsonValue } from '../contracts';
import { validateDateTimeModel, type DateTimeModel } from '../../data/date-time-model';
import type { NativeDefinition, NativePayload } from '../native-contract';

/** AtlasDateTime fixes the filled variant. */
const unrendered = ['variant'] as const;

/**
 * Reuse the complete DateTimeModel validator, then narrow it to what AtlasDateTime renders:
 * one value or one complete range, never multiple dates. Cell notes stay validated plain text.
 */
export function parseDateTimeModel(input: unknown): DateTimeModel {
  const model = validateDateTimeModel(input);
  if (model.multiple === true) throw new Error('model.multiple: expected a single value.');
  for (const key of unrendered)
    if (Object.hasOwn(model, key)) throw new Error(`model.${key}: expected no property.`);
  return model;
}

export const definition: NativeDefinition = {
  name: 'AtlasDateTimePicker',
  readOnly: false,
  parse: input => parseDateTimeModel(input) as unknown as NativePayload,
  withValue: (data: NativePayload, value: JsonValue) => definition.parse({ ...data, value }),
};

export const sample: NativePayload = {
  kind: 'date',
  label: 'Delivery date',
  value: '2026-10-20',
  minDate: '2026-10-01',
  maxDate: '2026-12-31',
  disabledWeekdays: [0, 6],
  required: true,
  help: 'Weekdays in the delivery window.',
};
