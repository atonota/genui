import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const KEYS = ['label', 'value', 'min', 'max', 'step', 'disabled', 'readOnly'] as const;
const REQUIRED = ['label', 'value'] as const;
const LIMIT = 1e15;
const LABEL_LIMIT = 160;

export interface InputNumberFields {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
  readOnly: boolean;
}

function finite(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > LIMIT)
    throw new Error(`InputNumber ${label} must be a bounded finite number.`);
  return value;
}

function optionalNumber(data: NativePayload, key: string): number | undefined {
  return Object.hasOwn(data, key) ? finite(data[key], key) : undefined;
}

function flag(data: NativePayload, key: string): boolean {
  if (!Object.hasOwn(data, key)) return false;
  if (typeof data[key] !== 'boolean') throw new Error(`InputNumber ${key} must be boolean.`);
  return data[key];
}

/** Validate an already parsed payload and expose its typed fields. */
export function inputNumberFields(data: NativePayload): InputNumberFields {
  const label = data.label;
  if (typeof label !== 'string' || !label.trim() || label.length > LABEL_LIMIT)
    throw new Error('InputNumber label must be non-empty bounded text.');
  const min = optionalNumber(data, 'min');
  const max = optionalNumber(data, 'max');
  const step = optionalNumber(data, 'step');
  if (step !== undefined && step <= 0) throw new Error('InputNumber step must be positive.');
  if (min !== undefined && max !== undefined && min > max)
    throw new Error('InputNumber min cannot exceed max.');
  const value = data.value === null ? null : finite(data.value, 'value');
  if (value !== null && ((min !== undefined && value < min) || (max !== undefined && value > max)))
    throw new Error('InputNumber value is outside its bounds.');
  return {
    label,
    value,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    disabled: flag(data, 'disabled'),
    readOnly: flag(data, 'readOnly'),
  };
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, KEYS, REQUIRED);
  inputNumberFields(data);
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXInputNumber',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Quantity',
  value: 2,
  min: 0,
  max: 10,
  step: 1,
};
