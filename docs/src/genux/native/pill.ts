import type { JsonValue } from '../contracts';
import { pillColorPresets } from '../../data/pill-palette';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const LABEL_LIMIT = 80;

function assertLabel(value: JsonValue | undefined): void {
  if (typeof value !== 'string' || !value.trim() || value.length > LABEL_LIMIT)
    throw new Error('GenUXPill label must be non-empty text up to 80 characters.');
}

function assertColorIndex(value: JsonValue | undefined): void {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= pillColorPresets.length
  )
    throw new Error('GenUXPill colorIndex must be a registered palette index.');
}

/** Read-only labelled status; colour is limited to registered palette presets. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['label', 'colorIndex'], ['label']);
  assertLabel(data.label);
  if (Object.hasOwn(data, 'colorIndex')) assertColorIndex(data.colorIndex);
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXPill',
  readOnly: true,
  parse,
};

export const sample: NativePayload = { label: 'Approved', colorIndex: 4 };
