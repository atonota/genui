import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

// Panels carry plain text only; sizes are percentages that always sum to 100.
const LABEL_LIMIT = 160;
const TEXT_LIMIT = 2000;
const SUM_TOLERANCE = 0.01;

export interface SplitterPanelView {
  id: string;
  label: string;
  text: string;
  min: number;
  max: number;
}

export interface SplitterView {
  id: string;
  label: string;
  panels: readonly [SplitterPanelView, SplitterPanelView];
  value: readonly [number, number];
  disabled: boolean;
}

function boundedText(value: unknown, path: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error(`${path}: expected non-empty bounded text.`);
  return value;
}

function percent(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)
    throw new Error(`${path}: expected a percentage from 0 to 100.`);
  return value;
}

function readPanel(input: JsonValue | undefined, index: number): SplitterPanelView {
  const path = `Splitter panel ${index}`;
  const data = nativeRecord(input, ['id', 'label', 'text', 'min', 'max'], ['id', 'label', 'text']);
  assertId(data.id, `${path} ID`);
  const min = data.min === undefined ? 0 : percent(data.min, `${path}.min`);
  const max = data.max === undefined ? 100 : percent(data.max, `${path}.max`);
  if (min > max) throw new Error(`${path}: minimum exceeds maximum.`);
  return {
    id: data.id,
    label: boundedText(data.label, `${path}.label`, LABEL_LIMIT),
    text: boundedText(data.text, `${path}.text`, TEXT_LIMIT),
    min,
    max,
  };
}

function inspect(input: unknown): { payload: NativePayload; view: SplitterView } {
  const payload = nativeRecord(
    input,
    ['id', 'label', 'panels', 'value', 'disabled'],
    ['id', 'label', 'panels', 'value'],
  );
  assertId(payload.id, 'Splitter ID');
  const label = boundedText(payload.label, 'Splitter label', LABEL_LIMIT);
  if (payload.disabled !== undefined && typeof payload.disabled !== 'boolean')
    throw new Error('Splitter disabled: expected boolean.');
  if (!Array.isArray(payload.panels) || payload.panels.length !== 2)
    throw new Error('Splitter panels: expected exactly two panels.');
  const first = readPanel(payload.panels[0], 0);
  const second = readPanel(payload.panels[1], 1);
  if (first.id === second.id) throw new Error('Duplicate Splitter panel identity.');
  // Bounds of the first panel implied by both panels' percentage limits.
  const min = Math.max(first.min, 100 - second.max);
  const max = Math.min(first.max, 100 - second.min);
  if (min > max) throw new Error('Splitter panel limits cannot share the layout.');
  if (!Array.isArray(payload.value) || payload.value.length !== 2)
    throw new Error('Splitter value: expected two sizes.');
  const a = percent(payload.value[0], 'Splitter value[0]');
  const b = percent(payload.value[1], 'Splitter value[1]');
  if (Math.abs(a + b - 100) > SUM_TOLERANCE)
    throw new Error('Splitter value: sizes must sum to 100.');
  if (a < min - SUM_TOLERANCE || a > max + SUM_TOLERANCE)
    throw new Error('Splitter value: sizes exceed the panel limits.');
  return {
    payload,
    view: {
      id: payload.id,
      label,
      panels: [first, second],
      value: [a, b],
      disabled: payload.disabled === true,
    },
  };
}

/** Typed, validated view for the native adapter. */
export function splitterView(input: unknown): SplitterView {
  return inspect(input).view;
}

export const definition: NativeDefinition = {
  name: 'AtlasSplitter',
  readOnly: false,
  parse: input => inspect(input).payload,
  withValue: (data, value) => definition.parse({ ...data, value }),
};

export const sample: NativePayload = {
  id: 'layout',
  label: 'Review layout',
  panels: [
    { id: 'summary', label: 'Summary', text: 'Totals for the quarter.' },
    { id: 'details', label: 'Details', text: 'Line items and notes.' },
  ],
  value: [40, 60],
};
