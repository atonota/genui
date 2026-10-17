import genux from '../../data/genux.json';
import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export type IconListEntry = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
};

const MAX_ITEMS = 24;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 480;

// Names GenUXIcon resolves outside genux.json; keep aligned with GenUXIconName.
const LOCAL_ICONS = [
  'minus',
  'trash',
  'x',
  'smiley',
  'smiley-sad',
  'sun',
  'moon',
  'house',
  'lock-simple',
] as const;
const ICON_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(genux.icons.phosphor.icons),
  ...LOCAL_ICONS,
]);

function boundedText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} must be non-empty text up to ${max} characters.`);
  return value.trim();
}

function parseItem(input: unknown, index: number): IconListEntry {
  const record = nativeRecord(input, ['id', 'title', 'description', 'icon'], ['id', 'title']);
  assertId(record.id, `items[${index}].id`);
  const item: IconListEntry = {
    id: record.id,
    title: boundedText(record.title, MAX_TITLE, `items[${index}].title`),
  };
  if (Object.hasOwn(record, 'description'))
    item.description = boundedText(
      record.description,
      MAX_DESCRIPTION,
      `items[${index}].description`,
    );
  if (Object.hasOwn(record, 'icon')) {
    if (typeof record.icon !== 'string' || !ICON_NAMES.has(record.icon))
      throw new Error(`items[${index}].icon is not a registered GenUX icon.`);
    item.icon = record.icon;
  }
  return item;
}

function parse(input: unknown): NativePayload {
  const record = nativeRecord(input, ['items'], ['items']);
  const items = record.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS)
    throw new Error(`items must contain 1 to ${MAX_ITEMS} entries.`);
  const parsed = items.map(parseItem);
  if (new Set(parsed.map(item => item.id)).size !== parsed.length)
    throw new Error('Icon list item IDs must be unique.');
  return { items: parsed as unknown as JsonValue[] };
}

export const definition: NativeDefinition = {
  name: 'GenUXIconList',
  readOnly: true,
  parse,
};

export const sample: NativePayload = {
  items: [
    {
      id: 'scope',
      title: 'Scoped to the active tenant',
      description: 'Only records from the selected workspace are listed.',
      icon: 'lock-simple',
    },
    { id: 'overview', title: 'Return to the overview at any time', icon: 'house' },
    { id: 'plain', title: 'Items without an icon keep their alignment' },
  ],
};
