import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export type RichMenuItemData = {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
};
export type RichMenuGroupData = { id: string; label: string; items: RichMenuItemData[] };
export type RichMenuData = {
  label: string;
  groups: RichMenuGroupData[];
  value: string | null;
  disabled?: boolean;
};

const LIMITS = Object.freeze({ groups: 8, items: 16, total: 48, label: 80, description: 240 });

function boundedText(value: JsonValue | undefined, max: number, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${path}: expected non-empty text up to ${max} characters.`);
  return value;
}

function optionalFlag(record: NativePayload, key: string, path: string): boolean | undefined {
  if (!Object.hasOwn(record, key)) return undefined;
  const value = record[key];
  if (typeof value !== 'boolean') throw new Error(`${path}.${key}: expected boolean.`);
  return value;
}

function boundedList(value: JsonValue | undefined, max: number, path: string): JsonValue[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max)
    throw new Error(`${path}: expected 1 to ${max} entries.`);
  return value;
}

function claimId(value: JsonValue | undefined, ids: Set<string>, path: string): string {
  assertId(value, `${path}.id`);
  if (ids.has(value)) throw new Error(`${path}.id: duplicate menu identity.`);
  ids.add(value);
  return value;
}

function readItem(input: JsonValue, path: string, ids: Set<string>): RichMenuItemData {
  const record = nativeRecord(
    input,
    ['id', 'label', 'description', 'disabled'],
    ['id', 'label', 'description'],
  );
  const item: RichMenuItemData = {
    id: claimId(record.id, ids, path),
    label: boundedText(record.label, LIMITS.label, `${path}.label`),
    description: boundedText(record.description, LIMITS.description, `${path}.description`),
  };
  const disabled = optionalFlag(record, 'disabled', path);
  if (disabled !== undefined) item.disabled = disabled;
  return item;
}

function readGroup(input: JsonValue, path: string, ids: Set<string>): RichMenuGroupData {
  const record = nativeRecord(input, ['id', 'label', 'items'], ['id', 'label', 'items']);
  const id = claimId(record.id, ids, path);
  const label = boundedText(record.label, LIMITS.label, `${path}.label`);
  const items = boundedList(record.items, LIMITS.items, `${path}.items`).map((item, index) =>
    readItem(item, `${path}.items[${index}]`, ids),
  );
  return { id, label, items };
}

function findItem(menu: RichMenuData, id: unknown): RichMenuItemData | undefined {
  return menu.groups.flatMap(group => group.items).find(item => item.id === id);
}

/** Exact, bounded menu data; the selected value must name an existing item. */
export function readRichMenu(input: unknown): RichMenuData {
  const record = nativeRecord(
    input,
    ['label', 'groups', 'value', 'disabled'],
    ['label', 'groups', 'value'],
  );
  const ids = new Set<string>();
  const groups = boundedList(record.groups, LIMITS.groups, 'RichMenu.groups').map((group, index) =>
    readGroup(group, `RichMenu.groups[${index}]`, ids),
  );
  if (groups.reduce((total, group) => total + group.items.length, 0) > LIMITS.total)
    throw new Error(`RichMenu: expected at most ${LIMITS.total} items.`);
  const menu: RichMenuData = {
    label: boundedText(record.label, LIMITS.label, 'RichMenu.label'),
    groups,
    value: null,
  };
  if (record.value !== null) {
    assertId(record.value, 'RichMenu.value');
    if (!findItem(menu, record.value)) throw new Error('RichMenu.value: unknown action.');
    menu.value = record.value;
  }
  const disabled = optionalFlag(record, 'disabled', 'RichMenu');
  if (disabled !== undefined) menu.disabled = disabled;
  return menu;
}

const parse = (input: unknown): NativePayload => readRichMenu(input) as unknown as NativePayload;

export const definition: NativeDefinition = {
  name: 'AtlasRichMenu',
  readOnly: false,
  parse,
  withValue(data, value) {
    const current = readRichMenu(data);
    if (current.disabled) throw new Error('RichMenu is disabled.');
    if (
      value !== null &&
      findItem(current, value)?.disabled !== false &&
      !isEnabled(current, value)
    )
      throw new Error('RichMenu value must be an enabled action.');
    return parse({ ...current, value });
  },
};

function isEnabled(menu: RichMenuData, id: unknown): boolean {
  const item = findItem(menu, id);
  return Boolean(item && item.disabled !== true);
}

export const sample: NativePayload = {
  label: 'Record actions',
  groups: [
    {
      id: 'share',
      label: 'Share',
      items: [
        { id: 'copy-link', label: 'Copy link', description: 'Copy a link to this record' },
        { id: 'export-csv', label: 'Export CSV', description: 'Download the visible rows' },
      ],
    },
    {
      id: 'manage',
      label: 'Manage',
      items: [
        {
          id: 'archive',
          label: 'Archive',
          description: 'Requires owner approval',
          disabled: true,
        },
      ],
    },
  ],
  value: null,
};
