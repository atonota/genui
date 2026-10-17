import type { JsonValue } from '../contracts';
import {
  GENUX_LIMITS,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

export interface PopconfirmPayload {
  title: string;
  description?: string;
  triggerLabel: string;
  value: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}

const allowed = ['title', 'description', 'triggerLabel', 'value', 'disabled', 'readOnly'] as const;
const required = ['title', 'triggerLabel', 'value'] as const;

function text(value: unknown, label: string, max: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`GenUXPopconfirm ${label}: expected non-empty bounded text.`);
}

function flag(value: unknown, label: string): void {
  if (typeof value !== 'boolean') throw new Error(`GenUXPopconfirm ${label}: expected boolean.`);
}

/** Controlled confirmation: value is only the open state; confirm runs the outer action. */
export const definition: NativeDefinition = {
  name: 'GenUXPopconfirm',
  readOnly: false,
  parse(input: unknown): NativePayload {
    const data = nativeRecord(input, allowed, required);
    text(data.title, 'title', GENUX_LIMITS.text);
    text(data.triggerLabel, 'triggerLabel', 80);
    if (Object.hasOwn(data, 'description'))
      text(data.description, 'description', GENUX_LIMITS.text);
    flag(data.value, 'value');
    if (Object.hasOwn(data, 'disabled')) flag(data.disabled, 'disabled');
    if (Object.hasOwn(data, 'readOnly')) flag(data.readOnly, 'readOnly');
    return data;
  },
  withValue(data: NativePayload, value: JsonValue): NativePayload {
    return definition.parse({ ...structuredClone(data), value: structuredClone(value) });
  },
};

export const sample: NativePayload = {
  title: 'Archive this record?',
  triggerLabel: 'Archive',
  value: false,
};
