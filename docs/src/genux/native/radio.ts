import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;
const MAX_LABEL = 120;

export interface GenUXRadioOption {
  id: string;
  label: string;
  disabled?: boolean;
}
export interface GenUXRadioPayload {
  label: string;
  options: GenUXRadioOption[];
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function label(value: unknown, path: string): void {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LABEL)
    throw new Error(`${path}: expected non-empty text up to ${MAX_LABEL} characters.`);
}
function flag(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path}: expected boolean.`);
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'options', 'value', 'disabled', 'readOnly'],
    ['label', 'options', 'value'],
  );
  label(data.label, 'GenUXRadio.label');
  flag(data.disabled, 'GenUXRadio.disabled');
  flag(data.readOnly, 'GenUXRadio.readOnly');
  if (
    !Array.isArray(data.options) ||
    data.options.length < MIN_OPTIONS ||
    data.options.length > MAX_OPTIONS
  )
    throw new Error(`GenUXRadio.options: expected ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`);
  const options = data.options.map((option, index) => {
    const path = `GenUXRadio.options[${index}]`;
    const entry = nativeRecord(option, ['id', 'label', 'disabled'], ['id', 'label']);
    assertId(entry.id, `${path}.id`);
    label(entry.label, `${path}.label`);
    flag(entry.disabled, `${path}.disabled`);
    return entry;
  });
  const ids = options.map(option => option.id as string);
  if (new Set(ids).size !== ids.length)
    throw new Error('GenUXRadio option identity is duplicated.');
  if (typeof data.value !== 'string' || !ids.includes(data.value))
    throw new Error('GenUXRadio.value: expected a declared option.');
  return { ...data, options };
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data) as unknown as GenUXRadioPayload;
  if (current.disabled === true || current.readOnly === true)
    throw new Error('GenUXRadio is not editable.');
  if (typeof value !== 'string') throw new Error('GenUXRadio value must be an option ID.');
  const option = current.options.find(entry => entry.id === value);
  if (!option || option.disabled === true)
    throw new Error('GenUXRadio value is not an enabled option.');
  return parse({ ...current, value });
}

export const definition: NativeDefinition = {
  name: 'GenUXRadio',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = {
  label: 'Team',
  value: 'design',
  options: [
    { id: 'design', label: 'Design' },
    { id: 'engineering', label: 'Engineering' },
    { id: 'operations', label: 'Operations', disabled: true },
  ],
};
