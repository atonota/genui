import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const MAX_OPTIONS = 24;
const MAX_LABEL = 160;

export interface SelectOption {
  id: string;
  label: string;
  disabled?: boolean;
}

function label(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LABEL)
    throw new Error(`${path}: expected non-empty text up to ${MAX_LABEL} characters.`);
  return value;
}

function flag(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path}: expected boolean.`);
}

function parseOptions(value: unknown): SelectOption[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OPTIONS)
    throw new Error(`AtlasSelect.options: expected 1 to ${MAX_OPTIONS} options.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const path = `AtlasSelect.options[${index}]`;
    const option = nativeRecord(entry, ['id', 'label', 'disabled'], ['id', 'label']);
    assertId(option.id, `${path}.id`);
    label(option.label, `${path}.label`);
    flag(option.disabled, `${path}.disabled`);
    if (ids.has(option.id)) throw new Error('Duplicate AtlasSelect option identity.');
    ids.add(option.id);
    return option as unknown as SelectOption;
  });
}

/** Selected ids as a list, for both single and multiple payloads. */
export function selectedIds(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string');
  return typeof value === 'string' ? [value] : [];
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'options', 'value', 'multiple', 'disabled'],
    ['label', 'options', 'value'],
  );
  label(data.label, 'AtlasSelect.label');
  flag(data.multiple, 'AtlasSelect.multiple');
  flag(data.disabled, 'AtlasSelect.disabled');
  const known = new Set(parseOptions(data.options).map(option => option.id));
  const value = data.value;
  if (data.multiple === true) {
    if (
      !Array.isArray(value) ||
      value.some(id => typeof id !== 'string' || !known.has(id)) ||
      new Set(value).size !== value.length
    )
      throw new Error('AtlasSelect value must list distinct registered options.');
  } else if (value !== null && (typeof value !== 'string' || !known.has(value)))
    throw new Error('AtlasSelect value must be a registered option or null.');
  return data;
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data);
  const next = parse({ ...current, value });
  const before = new Set(selectedIds(current.value));
  const blocked = new Set(
    (next.options as unknown as SelectOption[])
      .filter(option => option.disabled === true)
      .map(option => option.id),
  );
  if (selectedIds(next.value).some(id => blocked.has(id) && !before.has(id)))
    throw new Error('AtlasSelect cannot select a disabled option.');
  return next;
}

export const definition: NativeDefinition = {
  name: 'AtlasSelect',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = {
  label: 'Team',
  options: [
    { id: 'design', label: 'Design' },
    { id: 'engineering', label: 'Engineering' },
    { id: 'operations', label: 'Operations' },
    { id: 'archived', label: 'Archived', disabled: true },
  ],
  value: 'design',
};
