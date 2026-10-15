import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const allowed = ['label', 'value', 'disabled', 'readOnly'] as const;
const required = ['label', 'value'] as const;

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  if (typeof data.label !== 'string' || !data.label.trim() || data.label.length > 200)
    throw new Error('AtlasCheckbox.label: expected non-empty bounded text.');
  if (typeof data.value !== 'boolean') throw new Error('AtlasCheckbox.value: expected boolean.');
  for (const key of ['disabled', 'readOnly'])
    if (Object.hasOwn(data, key) && typeof data[key] !== 'boolean')
      throw new Error(`AtlasCheckbox.${key}: expected boolean.`);
  return data;
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data);
  if (current.disabled === true || current.readOnly === true)
    throw new Error('AtlasCheckbox is not editable.');
  return parse({ ...current, value });
}

export const definition: NativeDefinition = {
  name: 'AtlasCheckbox',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = { label: 'Notify the review team', value: false };
