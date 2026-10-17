import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const LABEL_LIMIT = 120;

/** A visible labelled action; the outer node action is its only host effect. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['label', 'disabled'], ['label']);
  const label: JsonValue | undefined = data.label;
  if (typeof label !== 'string' || !label.trim() || label.length > LABEL_LIMIT)
    throw new Error('GenUXButton.label: expected non-empty bounded text.');
  if (Object.hasOwn(data, 'disabled') && typeof data.disabled !== 'boolean')
    throw new Error('GenUXButton.disabled: expected boolean.');
  return data;
}

// A button carries no value, so there is no withValue; it is not public-eligible.
export const definition: NativeDefinition = {
  name: 'GenUXButton',
  readOnly: false,
  parse,
};

export const sample: NativePayload = { label: 'Review record' };
