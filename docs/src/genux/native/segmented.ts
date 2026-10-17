import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const limits = Object.freeze({ label: 120, minOptions: 2, maxOptions: 12 });

function label(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limits.label)
    throw new Error(`${path} must be non-empty bounded text.`);
  return value;
}

function flag(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path} must be boolean.`);
}

/** Bounded, unique options with a controlled value that must be one of them. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'options', 'value', 'disabled'],
    ['label', 'options', 'value'],
  );
  label(data.label, 'Segmented label');
  flag(data.disabled, 'Segmented disabled');
  const options = data.options;
  if (
    !Array.isArray(options) ||
    options.length < limits.minOptions ||
    options.length > limits.maxOptions
  )
    throw new Error(
      `Segmented options must contain ${limits.minOptions}-${limits.maxOptions} entries.`,
    );
  const values = options.map((option, index) => {
    const entry = nativeRecord(option, ['label', 'value', 'disabled'], ['label', 'value']);
    label(entry.label, `Segmented option ${index} label`);
    assertId(entry.value, `Segmented option ${index} value`);
    flag(entry.disabled, `Segmented option ${index} disabled`);
    return entry.value;
  });
  if (new Set(values).size !== values.length)
    throw new Error('Segmented option values must be unique.');
  if (typeof data.value !== 'string' || !values.includes(data.value))
    throw new Error('Segmented value must be one of its options.');
  return data;
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data);
  const option = (current.options as NativePayload[]).find(entry => entry.value === value);
  if (current.disabled === true || typeof value !== 'string' || !option || option.disabled === true)
    throw new Error('Segmented value is not selectable.');
  return parse({ ...current, value });
}

export const definition: NativeDefinition = {
  name: 'GenUXSegmented',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = {
  label: 'Report period',
  options: [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Quarter', value: 'quarter', disabled: true },
  ],
  value: 'week',
};
