import type { JsonValue } from '../contracts';
import {
  GENUI_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const allowed = [
  'value',
  'title',
  'body',
  'opener',
  'confirmLabel',
  'cancelLabel',
  'disabled',
] as const;
const required = ['value', 'title', 'body', 'opener'] as const;
const labelLimit = 80;

function boundedText(value: JsonValue | undefined, key: string, limit: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error(`AtlasModal.${key}: expected non-empty bounded text.`);
}

function openState(value: JsonValue | undefined): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error('AtlasModal.value: expected boolean.');
}

/** Exact keys only; the open state is the controlled runtime value. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  openState(data.value);
  boundedText(data.title, 'title', GENUI_LIMITS.text);
  boundedText(data.body, 'body', GENUI_LIMITS.text);
  boundedText(data.opener, 'opener', labelLimit);
  for (const key of ['confirmLabel', 'cancelLabel'] as const)
    if (Object.hasOwn(data, key)) boundedText(data[key], key, labelLimit);
  if (Object.hasOwn(data, 'disabled') && typeof data.disabled !== 'boolean')
    throw new Error('AtlasModal.disabled: expected boolean.');
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasModal',
  readOnly: false,
  parse,
  withValue(data, value) {
    openState(value);
    return parse({ ...data, value });
  },
};

export const sample: NativePayload = {
  value: false,
  title: 'Archive record',
  body: 'The record leaves the active list after confirmation.',
  opener: 'Review archive',
};
