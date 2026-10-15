import type { JsonValue } from '../contracts';
import {
  GENUI_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface AtlasInputData {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  maxLength?: number;
}

const allowed = [
  'label',
  'value',
  'placeholder',
  'required',
  'readOnly',
  'disabled',
  'maxLength',
] as const;
const required = ['label', 'value'] as const;
const flags = ['required', 'readOnly', 'disabled'] as const;

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  const { label, value, placeholder, maxLength } = data;
  if (typeof label !== 'string' || !label.trim() || label.length > GENUI_LIMITS.text)
    throw new Error('AtlasInput.label: expected non-empty bounded text.');
  if (
    placeholder !== undefined &&
    (typeof placeholder !== 'string' || placeholder.length > GENUI_LIMITS.text)
  )
    throw new Error('AtlasInput.placeholder: expected bounded text.');
  for (const flag of flags)
    if (data[flag] !== undefined && typeof data[flag] !== 'boolean')
      throw new Error(`AtlasInput.${flag}: expected boolean.`);
  if (
    maxLength !== undefined &&
    (!Number.isInteger(maxLength) ||
      (maxLength as number) < 1 ||
      (maxLength as number) > GENUI_LIMITS.text)
  )
    throw new Error(`AtlasInput.maxLength: expected integer 1..${GENUI_LIMITS.text}.`);
  const limit = (maxLength as number | undefined) ?? GENUI_LIMITS.text;
  if (typeof value !== 'string' || value.length > limit)
    throw new Error('AtlasInput.value: expected text within maxLength.');
  return data;
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data);
  if (current.readOnly === true || current.disabled === true)
    throw new Error('AtlasInput is not editable.');
  return parse({ ...current, value });
}

export const definition: NativeDefinition = {
  name: 'AtlasInput',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = {
  label: 'Display name',
  value: 'Aster',
  placeholder: 'Enter a display name',
  required: true,
  maxLength: 80,
};
