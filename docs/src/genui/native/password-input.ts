import type { JsonValue } from '../contracts';
import {
  GENUI_LIMITS,
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
] as const;

// Messages name the property only; the password value never enters an error.
function boundedText(value: JsonValue | undefined, key: string, max: number): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`Native property ${key} is invalid.`);
  return value;
}

function maxLengthOf(value: JsonValue | undefined): number {
  if (value === undefined) return GENUI_LIMITS.text;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > GENUI_LIMITS.text
  )
    throw new Error('Native property maxLength is invalid.');
  return value;
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, ['label', 'value']);
  if (!boundedText(data.label, 'label', GENUI_LIMITS.text).trim())
    throw new Error('Native property label is required.');
  if (data.placeholder !== undefined)
    boundedText(data.placeholder, 'placeholder', GENUI_LIMITS.text);
  for (const flag of ['required', 'readOnly', 'disabled'] as const)
    if (data[flag] !== undefined && typeof data[flag] !== 'boolean')
      throw new Error(`Native property ${flag} is invalid.`);
  boundedText(data.value, 'value', maxLengthOf(data.maxLength));
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasPasswordInput',
  readOnly: false,
  parse,
  withValue(data, value) {
    const current = parse(data);
    if (current.readOnly === true || current.disabled === true)
      throw new Error('Password input is not editable.');
    if (typeof value !== 'string') throw new Error('Native property value is invalid.');
    return parse({ ...current, value });
  },
};

export const sample: NativePayload = {
  label: 'Password',
  value: '',
  placeholder: 'Enter a password',
  required: true,
  maxLength: 64,
};
