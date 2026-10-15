import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const allowed = ['label', 'value', 'min', 'max', 'step', 'disabled', 'readOnly'] as const;
const required = ['label', 'value', 'min', 'max', 'step'] as const;

export interface SliderView {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  locked: boolean;
}

function finite(value: JsonValue | undefined, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e15)
    throw new Error(`AtlasSlider ${key} must be a bounded finite number.`);
  return value;
}

function flag(value: JsonValue | undefined, key: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error(`AtlasSlider ${key} must be a boolean.`);
  return value;
}

/** Read a validated payload; bounds, step and value must describe a reachable slider position. */
export function sliderView(data: NativePayload): SliderView {
  const label = data.label;
  if (typeof label !== 'string' || !label.trim() || label.length > 200)
    throw new Error('AtlasSlider label must be non-empty bounded text.');
  const value = finite(data.value, 'value');
  const min = finite(data.min, 'min');
  const max = finite(data.max, 'max');
  const step = finite(data.step, 'step');
  if (min >= max) throw new Error('AtlasSlider min must be below max.');
  if (step <= 0 || step > max - min) throw new Error('AtlasSlider step is invalid.');
  if (value < min || value > max) throw new Error('AtlasSlider value is out of bounds.');
  const offset = (value - min) / step;
  if (Math.abs(offset - Math.round(offset)) > 1e-9)
    throw new Error('AtlasSlider value is not on the step grid.');
  // Validate both flags before combining; || would skip readOnly when disabled is true.
  const disabled = flag(data.disabled, 'disabled');
  const readOnly = flag(data.readOnly, 'readOnly');
  return {
    label,
    value,
    min,
    max,
    step,
    locked: disabled || readOnly,
  };
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  sliderView(data);
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasSlider',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Review threshold',
  value: 40,
  min: 0,
  max: 100,
  step: 5,
};
