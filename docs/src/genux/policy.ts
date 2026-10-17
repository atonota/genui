import { CARD_PURPOSES, type GenUXCardModel } from '../data/card-model';
import { pillColorPresets } from '../data/pill-palette';
import {
  GENUX_COMPONENT_NAMES,
  type GenUXComponent,
  type JsonValue,
  type TaskBlockData,
} from './contracts';
import { assertId, assertPlainJSON, GENUX_LIMITS, UNSAFE_JSON_KEYS } from './native-contract';
import { nativeDefinition } from './native-registry';

export { assertId, assertPlainJSON, GENUX_LIMITS } from './native-contract';

type Rule = (value: unknown, path: string) => void;
const fail = (path: string, expected: string): never => {
  throw new Error(`${path}: expected ${expected}.`);
};
const text: Rule = (v, p) => {
  if (typeof v !== 'string' || !v.trim() || v.length > GENUX_LIMITS.text)
    fail(p, 'non-empty bounded text');
};
const freeText: Rule = (v, p) => {
  if (typeof v !== 'string' || v.length > GENUX_LIMITS.text) fail(p, 'bounded text');
};
const bool: Rule = (v, p) => {
  if (typeof v !== 'boolean') fail(p, 'boolean');
};
const number: Rule = (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e15) fail(p, 'finite number');
};
const positive: Rule = (v, p) => {
  number(v, p);
  if ((v as number) < 0) fail(p, 'non-negative number');
};
const paletteIndex: Rule = (v, p) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= pillColorPresets.length)
    fail(p, 'registered palette index');
};
const plainRecord: Rule = (v, p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p, 'object');
};
const nullable =
  (rule: Rule): Rule =>
  (v, p) => {
    if (v !== null) rule(v, p);
  };
const oneOf =
  (values: readonly string[]): Rule =>
  (v, p) => {
    if (typeof v !== 'string' || !values.includes(v)) fail(p, values.join(' | '));
  };
const list =
  (rule: Rule, max = 24): Rule =>
  (v, p) => {
    if (!Array.isArray(v) || v.length > max) fail(p, `array up to ${max}`);
    (v as unknown[]).forEach((item, i) => rule(item, `${p}[${i}]`));
  };
const object =
  (required: Record<string, Rule>, optional: Record<string, Rule> = {}): Rule =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p, 'object');
    const data = v as Record<string, unknown>;
    for (const [key, rule] of Object.entries(required)) {
      if (!Object.hasOwn(data, key)) fail(`${p}.${key}`, 'required value');
      rule(data[key], `${p}.${key}`);
    }
    for (const [key, value] of Object.entries(data)) {
      if (Object.hasOwn(required, key)) continue;
      if (!Object.hasOwn(optional, key)) fail(`${p}.${key}`, 'approved property');
      optional[key]!(value, `${p}.${key}`);
    }
  };
const id: Rule = (v, p) => assertId(v, p);
const currency: Rule = (v, p) => {
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) fail(p, 'three-letter currency');
};
const scalar: Rule = (v, p) => {
  if (v === null || typeof v === 'boolean') return;
  if (typeof v === 'number') number(v, p);
  else freeText(v, p);
};
const metric = object(
  { value: nullable(number), label: text, period: text },
  {
    unit: text,
    currency,
    delta: nullable(number),
    comparison: text,
    meaning: oneOf(['positive', 'negative', 'neutral']),
  },
);
const fact = object(
  { key: id, label: text, value: scalar },
  { format: oneOf(['text', 'number', 'currency', 'percent', 'date']), currency },
);
const item = object(
  { id, title: text },
  { detail: freeText, state: oneOf(['pending', 'active', 'complete']) },
);
const field = object(
  { key: id, label: text, value: freeText },
  { required: bool, readOnly: bool, error: text },
);
const action = object(
  {
    id,
    label: text,
    intent: oneOf(['inspect', 'select', 'move', 'retry', 'create', 'connect', 'review', 'open']),
  },
  { disabled: bool, reason: text },
);
const modelRule = object(
  { id, kind: oneOf(CARD_PURPOSES), title: text },
  {
    description: freeText,
    eyebrow: text,
    status: object(
      {
        label: text,
        tone: oneOf(['default', 'success', 'processing', 'warning', 'error']),
      },
      { colorIndex: paletteIndex },
    ),
    media: object(
      { kind: oneOf(['monogram', 'symbol']), label: text },
      { symbol: oneOf(['place', 'vehicle', 'person', 'product', 'document', 'course', 'media']) },
    ),
    facts: list(fact),
    items: list(item),
    primaryAction: action,
    secondaryActions: list(action, 4),
    source: object({
      label: text,
      sourceId: text,
      observedAt: text,
      mode: oneOf(['recorded', 'host', 'user']),
    }),
    state: oneOf(['ready', 'loading', 'empty', 'partial', 'error', 'disabled']),
    stateMessage: text,
    layout: oneOf(['vertical', 'horizontal', 'auto']),
    density: oneOf(['compact', 'comfortable']),
    metric,
    metrics: list(
      object(
        { id, value: nullable(number), label: text, period: text },
        {
          unit: text,
          currency,
          delta: nullable(number),
          comparison: text,
          meaning: oneOf(['positive', 'negative', 'neutral']),
        },
      ),
      8,
    ),
    selection: object({ mode: oneOf(['single', 'multiple']), selected: bool, group: id }),
    task: object({
      lane: oneOf(['planned', 'active', 'done']),
      priority: oneOf(['low', 'normal', 'high']),
      completed: positive,
      total: positive,
    }),
    pricing: object({ amount: positive, currency, interval: text, features: list(text, 12) }),
    fields: list(field, 12),
    file: object({ name: text, mime: text, sizeBytes: positive }, { durationSeconds: positive }),
    connection: oneOf(['available', 'connected', 'unavailable']),
    details: object({ heading: text, body: freeText }),
  },
);
export function validateCardModel(value: unknown): GenUXCardModel {
  assertPlainJSON(value);
  modelRule(value, 'Card');
  const model = value as unknown as GenUXCardModel;
  const actionIds = [model.primaryAction, ...(model.secondaryActions ?? [])]
    .filter(Boolean)
    .map(value => value!.id);
  if (new Set(actionIds).size !== actionIds.length)
    throw new Error('Duplicate Card action identity.');
  const required: Partial<Record<GenUXCardModel['kind'], keyof GenUXCardModel>> = {
    metric: 'metric',
    widget: 'metrics',
    selection: 'selection',
    task: 'task',
    pricing: 'pricing',
    form: 'fields',
    media: 'file',
    integration: 'connection',
  };
  const expected = required[model.kind];
  if (expected && !Object.hasOwn(model, expected))
    throw new Error(`${model.kind} requires ${expected}.`);
  const exclusive = {
    metric: ['metric', 'insight'],
    metrics: ['widget'],
    selection: ['selection', 'pricing'],
    task: ['task'],
    pricing: ['pricing'],
    fields: ['form'],
    file: ['media'],
    connection: ['integration'],
  } as const;
  for (const [key, purposes] of Object.entries(exclusive))
    if (Object.hasOwn(model, key) && !(purposes as readonly string[]).includes(model.kind))
      throw new Error(`${key} does not belong to ${model.kind}.`);
  for (const collection of [model.facts, model.items, model.fields, model.metrics]) {
    if (!collection) continue;
    const keys = collection.map(entry => ('key' in entry ? entry.key : entry.id));
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate Card field/item identity.');
  }
  if (
    model.task &&
    (!Number.isInteger(model.task.completed) ||
      !Number.isInteger(model.task.total) ||
      model.task.completed > model.task.total)
  )
    throw new Error('Task progress is invalid.');
  if (model.source && !Number.isFinite(Date.parse(model.source.observedAt)))
    throw new Error('Source time is invalid.');
  for (const entry of model.facts ?? []) {
    if (
      entry.format === 'currency' &&
      (!entry.currency || (entry.value !== null && typeof entry.value !== 'number'))
    )
      throw new Error('Currency fact requires a numeric value and currency.');
    if (
      ['number', 'percent'].includes(entry.format ?? '') &&
      entry.value !== null &&
      typeof entry.value !== 'number'
    )
      throw new Error('Numeric fact has a non-numeric value.');
    if (
      entry.format === 'date' &&
      entry.value !== null &&
      (typeof entry.value !== 'string' || !Number.isFinite(Date.parse(entry.value)))
    )
      throw new Error('Date fact is invalid.');
  }
  return structuredClone(model);
}
export function pointerParts(path: unknown): string[] {
  if (
    typeof path !== 'string' ||
    path.length > 512 ||
    !/^\/state(?:\/[A-Za-z][A-Za-z0-9_-]{0,79})*$/.test(path)
  )
    throw new Error('Only safe identifier paths below /state are supported.');
  const parts = path.slice(1).split('/');
  if (parts.some(part => UNSAFE_JSON_KEYS.has(part))) throw new Error('Unsafe model path.');
  return parts;
}
export function readPointer(value: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const key of pointerParts(path)) {
    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !Object.hasOwn(current, key)
    )
      return undefined;
    current = current[key];
  }
  return current;
}
export function writePointer(value: JsonValue, path: string, update: JsonValue): JsonValue {
  const parts = pointerParts(path);
  const root =
    value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
  let current = root as Record<string, JsonValue>;
  for (const key of parts.slice(0, -1)) {
    const child = current[key];
    if (child !== undefined && (!child || typeof child !== 'object' || Array.isArray(child)))
      throw new Error('Model path crosses a scalar or array.');
    if (child === undefined) current[key] = {};
    current = current[key] as Record<string, JsonValue>;
  }
  current[parts.at(-1)!] = structuredClone(update);
  return root;
}
export function validateComponent(value: unknown): GenUXComponent {
  const binding: Rule = (v, p) => {
    object({
      path: path => {
        pointerParts(path);
      },
    })(v, p);
  };
  const card: Rule = v => {
    if (v && typeof v === 'object' && Object.hasOwn(v, 'path')) binding(v, 'model');
    else validateCardModel(v);
  };
  object(
    { id, component: oneOf(GENUX_COMPONENT_NAMES) },
    {
      child: id,
      children: list(id, GENUX_LIMITS.nodes),
      model: card,
      payload: (v, p) => {
        if (v && typeof v === 'object' && Object.hasOwn(v, 'path')) binding(v, p);
        else validateTaskBlock((value as GenUXComponent).component, v);
      },
      text: (v, p) => (typeof v === 'string' ? freeText(v, p) : binding(v, p)),
      direction: oneOf(['stack', 'grid']),
    },
  )(value, 'Component');
  const component = value as GenUXComponent;
  if (component.child && component.children) throw new Error('Use child or children, never both.');
  if (component.component === 'GenUXStack') {
    if (component.model || component.payload || component.text !== undefined)
      throw new Error('Layout accepts only approved child references and direction.');
  } else if (component.component === 'GenUXText') {
    if (
      component.text === undefined ||
      component.model ||
      component.payload ||
      component.child ||
      component.children ||
      component.direction
    )
      throw new Error('Text accepts only text.');
  } else if (
    ['GenUXEntityCard', 'GenUXMetricCard', 'GenUXPurposeCard'].includes(component.component)
  ) {
    if (
      !component.model ||
      component.payload ||
      component.child ||
      component.children ||
      component.direction ||
      component.text !== undefined
    )
      throw new Error('Purpose Cards require a model and cannot contain child components.');
  } else {
    if (
      !component.payload ||
      component.model ||
      component.direction ||
      component.text !== undefined ||
      (component.component !== 'GenUXTaskSurface' && (component.child || component.children))
    )
      throw new Error('Task blocks accept a typed payload; only TaskSurface may contain blocks.');
  }
  return structuredClone(component);
}

export function validateTaskBlock(component: string, value: unknown): TaskBlockData {
  assertPlainJSON(value);
  const optionalAction = { action };
  const native = nativeDefinition(component);
  if (native) {
    // Native blocks share one strict envelope; the registered definition owns `native`.
    object({ title: text, native: plainRecord }, optionalAction)(value, component);
    const envelope = value as TaskBlockData;
    const parsed: unknown = native.parse(envelope.native);
    assertPlainJSON(parsed);
    plainRecord(parsed, `${component}.native`);
    return structuredClone({ ...envelope, native: parsed as Record<string, JsonValue> });
  }
  const rules: Record<string, Rule> = {
    GenUXTaskSurface: object(
      {
        title: text,
        intent: oneOf(['query', 'compare', 'analyze', 'draft', 'review', 'track', 'configure']),
      },
      { description: freeText, scopeLabel: text },
    ),
    GenUXCollection: object(
      {
        title: text,
        columns: list(
          object(
            { key: id, label: text },
            { format: oneOf(['text', 'number', 'currency']), currency },
          ),
          12,
        ),
        rows: list((row, path) => {
          const data = recordValue(row, path);
          id(data.id, `${path}.id`);
          for (const [key, val] of Object.entries(data)) {
            id(key, path);
            scalar(val, `${path}.${key}`);
          }
        }, 100),
      },
      { selection: list(id, 100), groupBy: id },
    ),
    GenUXChart: object(
      { title: text, points: list(object({ label: text, value: number }), 24) },
      { unit: text },
    ),
    GenUXForm: object({ title: text, fields: list(field, 12) }, optionalAction),
    GenUXChoice: object(
      {
        title: text,
        options: list(object({ id, label: text }), 24),
        value: (v, p) => (Array.isArray(v) ? list(id)(v, p) : id(v, p)),
      },
      { multiple: bool },
    ),
    GenUXAction: object({ action }),
    GenUXEmpty: object({ title: text }, { description: freeText, ...optionalAction }),
  };
  if (!rules[component]) throw new Error('Unknown task block.');
  rules[component]!(value, component);
  const block = value as TaskBlockData;
  for (const array of [block.columns, block.rows, block.fields, block.options])
    if (array) {
      const keys = array.map(entry => ('key' in entry ? entry.key : 'id' in entry ? entry.id : ''));
      if (new Set(keys).size !== keys.length) throw new Error('Duplicate task block identity.');
    }
  if (block.rows && block.columns) {
    const keys = new Set(['id', ...block.columns.map(column => column.key)]);
    for (const row of block.rows)
      if (Object.keys(row).some(key => !keys.has(key)))
        throw new Error('Collection data contains an undeclared field.');
    if (block.selection?.some(key => !block.rows!.some(row => row.id === key)))
      throw new Error('Collection selection is invalid.');
    if (block.groupBy && !block.columns.some(column => column.key === block.groupBy))
      throw new Error('Collection grouping is invalid.');
  }
  if (block.options) {
    const values = Array.isArray(block.value) ? block.value : [block.value];
    if (
      values.some(value => !block.options!.some(option => option.id === value)) ||
      (!block.multiple && Array.isArray(block.value)) ||
      (block.multiple && !Array.isArray(block.value))
    )
      throw new Error('Choice value is invalid.');
  }
  return structuredClone(block);
}
function recordValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'record');
  return value as Record<string, unknown>;
}
