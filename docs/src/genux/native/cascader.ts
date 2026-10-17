import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const LIMITS = Object.freeze({ depth: 8, options: 100, label: 160, text: 480 });
const PAYLOAD_KEYS = [
  'label',
  'options',
  'value',
  'placeholder',
  'help',
  'disabled',
  'readOnly',
  'selectionLabel',
  'multiple',
] as const;
const OPTION_KEYS = ['value', 'label', 'description', 'disabled', 'children'] as const;

function text(value: unknown, path: string, max: number = LIMITS.label): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${path}: expected non-empty bounded text.`);
}
function flag(data: NativePayload, key: string, path: string): void {
  if (Object.hasOwn(data, key) && typeof data[key] !== 'boolean')
    throw new Error(`${path}.${key}: expected boolean.`);
}

/**
 * Fully loaded tree: bounded total size and depth, values unique among siblings.
 * Multiple selection addresses options by complete path, so a value may repeat under
 * different parents; single selection keeps its tree-wide unique IDs.
 */
function parseOptions(input: JsonValue | undefined, treeUnique: boolean): NativePayload[] {
  const tree = new Set<string>();
  let count = 0;
  const visit = (items: JsonValue | undefined, depth: number, path: string): NativePayload[] => {
    if (depth > LIMITS.depth) throw new Error(`${path}: depth limit exceeded.`);
    if (!Array.isArray(items) || items.length === 0)
      throw new Error(`${path}: expected a non-empty option list.`);
    const siblings = new Set<string>();
    return items.map((item, index) => {
      const at = `${path}[${index}]`;
      const option = nativeRecord(item, OPTION_KEYS, ['value', 'label']);
      assertId(option.value, `${at}.value`);
      if (siblings.has(option.value) || (treeUnique && tree.has(option.value)))
        throw new Error(`${at}.value: duplicate option ${option.value}.`);
      siblings.add(option.value);
      tree.add(option.value);
      if (++count > LIMITS.options) throw new Error(`${path}: option limit exceeded.`);
      text(option.label, `${at}.label`);
      if (Object.hasOwn(option, 'description'))
        text(option.description, `${at}.description`, LIMITS.text);
      flag(option, 'disabled', at);
      if (Object.hasOwn(option, 'children'))
        option.children = visit(option.children, depth + 1, `${at}.children`);
      return option;
    });
  };
  return visit(input, 1, 'options');
}

/** A complete path to an enabled leaf; disabled parents block it. */
function parsePath(options: NativePayload[], value: JsonValue | undefined, at: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > LIMITS.depth)
    throw new Error(`${at}: expected a complete option path.`);
  let level: NativePayload[] | undefined = options;
  for (const id of value) {
    const option: NativePayload | undefined = level?.find(entry => entry.value === id);
    if (!option || option.disabled === true)
      throw new Error(`${at}: expected an enabled option path.`);
    level = option.children as NativePayload[] | undefined;
  }
  if (level) throw new Error(`${at}: expected a path ending at a leaf.`);
  return value as string[];
}

/** Single: null or one complete path. Multiple: distinct complete paths; cleared is []. */
function parseValue(
  options: NativePayload[],
  value: JsonValue | undefined,
  multiple: boolean,
): string[] | string[][] | null {
  if (!multiple) {
    if (value === null) return null;
    if (!Array.isArray(value)) throw new Error('value: expected a complete option path or null.');
    return parsePath(options, value, 'value');
  }
  if (!Array.isArray(value) || value.length > LIMITS.options)
    throw new Error('value: expected a list of complete option paths.');
  const seen = new Set<string>();
  return value.map((path, index) => {
    const parsed = parsePath(options, path, `value[${index}]`);
    const key = JSON.stringify(parsed);
    if (seen.has(key)) throw new Error(`value[${index}]: duplicate path.`);
    seen.add(key);
    return parsed;
  });
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, PAYLOAD_KEYS, ['label', 'options', 'value']);
  text(data.label, 'label');
  if (Object.hasOwn(data, 'placeholder')) text(data.placeholder, 'placeholder');
  if (Object.hasOwn(data, 'help')) text(data.help, 'help', LIMITS.text);
  flag(data, 'disabled', 'native');
  flag(data, 'readOnly', 'native');
  flag(data, 'multiple', 'native');
  if (
    Object.hasOwn(data, 'selectionLabel') &&
    data.selectionLabel !== 'path' &&
    data.selectionLabel !== 'leaf'
  )
    throw new Error('selectionLabel: expected path | leaf.');
  const multiple = data.multiple === true;
  const options = parseOptions(data.options, !multiple);
  return { ...data, options, value: parseValue(options, data.value, multiple) };
}

export const definition: NativeDefinition = {
  name: 'GenUXCascader',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Service area',
  placeholder: 'Choose a service area',
  options: [
    {
      value: 'north',
      label: 'North region',
      children: [
        { value: 'harbor', label: 'Harbor district' },
        { value: 'old-town', label: 'Old town', disabled: true },
      ],
    },
    {
      value: 'south',
      label: 'South region',
      description: 'Coastal teams',
      children: [{ value: 'bay', label: 'Bay office' }],
    },
  ],
  value: ['north', 'harbor'],
};
