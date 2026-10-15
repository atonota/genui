import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const MAX_ENTRIES = 8;
const MAX_LABEL = 80;

function label(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LABEL)
    throw new Error(`${path}: expected non-empty bounded text.`);
  return value;
}

function parseEntry(input: unknown, index: number): NativePayload {
  const entry = nativeRecord(input, ['key', 'label', 'disabled'], ['key', 'label']);
  assertId(entry.key, `Breadcrumb entry ${index} key`);
  label(entry.label, `Breadcrumb entry ${index} label`);
  if (Object.hasOwn(entry, 'disabled') && typeof entry.disabled !== 'boolean')
    throw new Error(`Breadcrumb entry ${index} disabled must be boolean.`);
  return entry;
}

/** Named path entries only; the model never supplies hrefs, routes or handlers. */
export const definition: NativeDefinition = {
  name: 'AtlasBreadcrumb',
  readOnly: false,
  parse(input) {
    const data = nativeRecord(
      input,
      ['label', 'items', 'value', 'disabled'],
      ['label', 'items', 'value'],
    );
    label(data.label, 'Breadcrumb label');
    if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > MAX_ENTRIES)
      throw new Error(`Breadcrumb items: expected 1 to ${MAX_ENTRIES} entries.`);
    const items = data.items.map(parseEntry);
    const keys = items.map(entry => entry.key as string);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate breadcrumb entry key.');
    const current = items.find(entry => entry.key === data.value);
    if (!current) throw new Error('Breadcrumb value must name an entry.');
    if (current.disabled === true)
      throw new Error('Breadcrumb value cannot name a disabled entry.');
    if (Object.hasOwn(data, 'disabled') && typeof data.disabled !== 'boolean')
      throw new Error('Breadcrumb disabled must be boolean.');
    return { ...data, items: items as JsonValue[] };
  },
  withValue(data, value) {
    return definition.parse({ ...data, value });
  },
};

export const sample: NativePayload = {
  label: 'Catalog path',
  items: [
    { key: 'home', label: 'Home' },
    { key: 'catalog', label: 'Catalog' },
    { key: 'lighting', label: 'Lighting' },
    { key: 'lamps', label: 'Desk lamps' },
    { key: 'archive', label: 'Archive', disabled: true },
  ],
  value: 'lighting',
};
