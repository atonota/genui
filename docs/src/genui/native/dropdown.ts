import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface DropdownItem {
  id: string;
  label: string;
  disabled?: boolean;
}
export interface DropdownData {
  label: string;
  items: readonly DropdownItem[];
  value: string | null;
  disabled?: boolean;
}

const maxItems = 24;
const maxLabel = 120;

function label(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLabel)
    throw new Error(`${path}: expected non-empty bounded text.`);
}
function flag(data: NativePayload, path: string) {
  if (Object.hasOwn(data, 'disabled') && typeof data.disabled !== 'boolean')
    throw new Error(`${path}.disabled: expected boolean.`);
}

/** Action menu with bounded unique items; value is a listed item ID or null. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(
    input,
    ['label', 'items', 'value', 'disabled'],
    ['label', 'items', 'value'],
  );
  label(data.label, 'AtlasDropdown.label');
  flag(data, 'AtlasDropdown');
  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > maxItems)
    throw new Error(`AtlasDropdown.items: expected 1 to ${maxItems} items.`);
  const ids = new Set<string>();
  const items = data.items.map((entry, index) => {
    const path = `AtlasDropdown.items[${index}]`;
    const item = nativeRecord(entry, ['id', 'label', 'disabled'], ['id', 'label']);
    assertId(item.id, `${path}.id`);
    label(item.label, `${path}.label`);
    flag(item, path);
    if (ids.has(item.id)) throw new Error('Duplicate AtlasDropdown item identity.');
    ids.add(item.id);
    return item;
  });
  if (data.value !== null && (typeof data.value !== 'string' || !ids.has(data.value)))
    throw new Error('AtlasDropdown.value: expected a listed item ID or null.');
  return { ...data, items };
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = parse(data) as unknown as DropdownData;
  if (current.disabled) throw new Error('AtlasDropdown is disabled.');
  if (value !== null && current.items.find(item => item.id === value)?.disabled === true)
    throw new Error('AtlasDropdown.value: disabled items cannot be selected.');
  return parse({ ...(current as unknown as NativePayload), value });
}

export const definition: NativeDefinition = {
  name: 'AtlasDropdown',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = {
  label: 'Record actions',
  items: [{ id: 'inspect', label: 'Inspect record' }],
  value: null,
};
