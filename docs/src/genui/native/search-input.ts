import {
  GENUI_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const allowed = ['label', 'value', 'placeholder', 'maxLength', 'disabled', 'readOnly'] as const;

// Search is a local JSON draft plus an optional caller-owned action; the payload
// never carries an endpoint, query template or submit target.
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, ['label', 'value']);
  const { label, value, placeholder, maxLength, disabled, readOnly } = data;
  if (typeof label !== 'string' || !label.trim()) throw new Error('Search label is invalid.');
  if (typeof value !== 'string') throw new Error('Search value must be text.');
  if (placeholder !== undefined && typeof placeholder !== 'string')
    throw new Error('Search placeholder must be text.');
  if (
    maxLength !== undefined &&
    (typeof maxLength !== 'number' ||
      !Number.isInteger(maxLength) ||
      maxLength < 1 ||
      maxLength > GENUI_LIMITS.text)
  )
    throw new Error('Search maxLength is invalid.');
  if (typeof maxLength === 'number' && value.length > maxLength)
    throw new Error('Search value exceeds maxLength.');
  for (const flag of [disabled, readOnly])
    if (flag !== undefined && typeof flag !== 'boolean')
      throw new Error('Search flags must be boolean.');
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasSearchInput',
  readOnly: false,
  parse,
  withValue(data, value) {
    const current = parse(data);
    if (current.readOnly === true || current.disabled === true)
      throw new Error('Search input is not editable.');
    if (typeof value !== 'string') throw new Error('Search value must be text.');
    return parse({ ...current, value });
  },
};

export const sample: NativePayload = {
  label: 'Search records',
  value: 'Aster',
  placeholder: 'Search by name',
  maxLength: 120,
};
