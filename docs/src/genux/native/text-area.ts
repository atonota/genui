import type { JsonValue } from '../contracts';
import {
  GENUX_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const allowed = [
  'label',
  'value',
  'placeholder',
  'maxLength',
  'required',
  'readOnly',
  'disabled',
  'rows',
] as const;
const required = ['label', 'value'] as const;

const text = (value: unknown, label: string, max: number = GENUX_LIMITS.text): string => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid.`);
  return value;
};
const flag = (value: unknown, label: string): void => {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label} is invalid.`);
};
const integer = (value: unknown, label: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new Error(`${label} is invalid.`);
  return value;
};

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  if (!text(data.label, 'Text area label', 160).trim())
    throw new Error('Text area label is invalid.');
  if (data.placeholder !== undefined) text(data.placeholder, 'Text area placeholder', 240);
  const maxLength =
    data.maxLength === undefined
      ? GENUX_LIMITS.text
      : integer(data.maxLength, 'Text area maxLength', 1, GENUX_LIMITS.text);
  text(data.value, 'Text area value', maxLength);
  flag(data.required, 'Text area required');
  flag(data.readOnly, 'Text area readOnly');
  flag(data.disabled, 'Text area disabled');
  if (data.rows !== undefined) integer(data.rows, 'Text area rows', 2, 12);
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXTextArea',
  readOnly: false,
  parse,
  // Returns a new JSON draft; the source payload is never mutated or written back.
  withValue(data: NativePayload, value: JsonValue): NativePayload {
    const current = parse(data);
    if (current.readOnly === true || current.disabled === true)
      throw new Error('Text area does not accept changes.');
    if (typeof value !== 'string') throw new Error('Text area value must be text.');
    return parse({ ...current, value });
  },
};

export const sample: NativePayload = {
  label: 'Release notes',
  value: 'Fixed sync retries.\nImproved export labels.',
  placeholder: 'Describe the change',
  maxLength: 500,
  required: true,
  rows: 4,
};
