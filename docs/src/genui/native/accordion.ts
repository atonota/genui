import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface AccordionItem {
  id: string;
  title: string;
  body: string;
  disabled?: boolean;
}
export interface AccordionView {
  items: AccordionItem[];
  value: string[];
  disabled: boolean;
}

const MAX_ITEMS = 12;
const MAX_TITLE = 160;
const MAX_BODY = 2000;

function boundedText(value: JsonValue | undefined, label: string, max: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} must be non-empty text up to ${max} characters.`);
}
function optionalFlag(value: JsonValue | undefined, label: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${label} must be a boolean.`);
}

/** Exact, bounded disclosure items; expanded IDs must be unique enabled members. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['items', 'value', 'disabled'], ['items', 'value']);
  optionalFlag(data.disabled, 'Accordion disabled');
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS)
    throw new Error(`Accordion requires 1 to ${MAX_ITEMS} items.`);
  const ids = new Set<string>();
  const locked = new Set<string>();
  for (const entry of items) {
    const item = nativeRecord(entry, ['id', 'title', 'body', 'disabled'], ['id', 'title', 'body']);
    assertId(item.id, 'Accordion item ID');
    if (ids.has(item.id)) throw new Error('Duplicate accordion item identity.');
    ids.add(item.id);
    boundedText(item.title, 'Accordion title', MAX_TITLE);
    boundedText(item.body, 'Accordion body', MAX_BODY);
    optionalFlag(item.disabled, 'Accordion item disabled');
    if (item.disabled === true) locked.add(item.id);
  }
  const value = data.value;
  if (!Array.isArray(value) || value.length > items.length)
    throw new Error('Accordion value must list expanded item IDs.');
  const expanded = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || !ids.has(id))
      throw new Error('Accordion value has an unknown ID.');
    if (expanded.has(id)) throw new Error('Accordion value repeats an ID.');
    if (locked.has(id)) throw new Error('Accordion value expands a disabled item.');
    expanded.add(id);
  }
  return data;
}

export function readAccordion(input: unknown): AccordionView {
  const data = parse(input);
  return {
    items: data.items as unknown as AccordionItem[],
    value: data.value as string[],
    disabled: data.disabled === true,
  };
}

export const definition: NativeDefinition = {
  name: 'AtlasAccordion',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  items: [
    { id: 'scope', title: 'Scope', body: 'Records from the selected workspace.' },
    { id: 'source', title: 'Source', body: 'Recorded host snapshot.' },
    { id: 'retention', title: 'Retention', body: 'Kept for 30 days.', disabled: true },
  ],
  value: ['scope'],
};
