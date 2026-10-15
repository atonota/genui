import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const allowed = ['label', 'value', 'disabled'] as const;
const required = ['label', 'value'] as const;

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  const label = data.label;
  if (typeof label !== 'string' || !label.trim() || label.length > 120)
    throw new Error('AtlasSwitch.label: expected non-empty bounded text.');
  if (typeof data.value !== 'boolean') throw new Error('AtlasSwitch.value: expected boolean.');
  if (Object.hasOwn(data, 'disabled') && typeof data.disabled !== 'boolean')
    throw new Error('AtlasSwitch.disabled: expected boolean.');
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasSwitch',
  readOnly: false,
  parse,
  withValue: (data: NativePayload, value: JsonValue) => parse({ ...data, value }),
};

export const sample: NativePayload = { label: 'Email notifications', value: false };
