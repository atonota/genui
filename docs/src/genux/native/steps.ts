import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface StepsItem {
  id: string;
  title: string;
  description?: string;
  disabled?: boolean;
}
export interface StepsData {
  label?: string;
  items: StepsItem[];
  value: number;
  disabled?: boolean;
}

const limits = { items: 12, title: 120, description: 280, label: 120 } as const;

function boundedText(value: unknown, path: string, max: number, allowEmpty = false): void {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error(`${path}: expected bounded text.`);
}

function flag(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path}: expected boolean.`);
}

function parseItem(input: unknown, index: number): NativePayload {
  const path = `GenUXSteps.items[${index}]`;
  const item = nativeRecord(input, ['id', 'title', 'description', 'disabled'], ['id', 'title']);
  assertId(item.id, `${path}.id`);
  boundedText(item.title, `${path}.title`, limits.title);
  if (item.description !== undefined)
    boundedText(item.description, `${path}.description`, limits.description, true);
  flag(item.disabled, `${path}.disabled`);
  return item;
}

/** Bounded steps list with a controlled current index; the index must name an enabled step. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['label', 'items', 'value', 'disabled'], ['items', 'value']);
  if (data.label !== undefined) boundedText(data.label, 'GenUXSteps.label', limits.label);
  flag(data.disabled, 'GenUXSteps.disabled');
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > limits.items)
    throw new Error(`GenUXSteps.items: expected 1 to ${limits.items} steps.`);
  const items = data.items.map(parseItem);
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate GenUXSteps step identity.');
  const value = data.value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= items.length)
    throw new Error('GenUXSteps.value: expected an existing step index.');
  if (items[value]!.disabled === true) throw new Error('GenUXSteps.value: step is disabled.');
  return { ...data, items };
}

export const definition: NativeDefinition = {
  name: 'GenUXSteps',
  readOnly: false,
  parse,
  withValue: (data: NativePayload, value: JsonValue) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Onboarding progress',
  value: 0,
  items: [
    { id: 'account', title: 'Account', description: 'Confirm the workspace owner.' },
    { id: 'review', title: 'Review', description: 'Check imported records.' },
    { id: 'publish', title: 'Publish', disabled: true },
  ],
};
