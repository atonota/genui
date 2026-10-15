import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const statuses = ['info', 'success', 'warning', 'error'] as const;
export type NotificationStatus = (typeof statuses)[number];

export interface NotificationData {
  /** Controlled open state; only a local user trigger may request `true`. */
  value: boolean;
  message: string;
  status: NotificationStatus;
  description?: string;
  disabled?: boolean;
}

const allowed = ['value', 'message', 'status', 'description', 'disabled'] as const;
const required = ['value', 'message'] as const;

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  if (typeof data.value !== 'boolean') throw new Error('Notification value must be boolean.');
  if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 160)
    throw new Error('Notification message must be non-empty bounded text.');
  if (
    data.status !== undefined &&
    (typeof data.status !== 'string' || !(statuses as readonly string[]).includes(data.status))
  )
    throw new Error('Notification status is not registered.');
  if (
    data.description !== undefined &&
    (typeof data.description !== 'string' || data.description.length > 600)
  )
    throw new Error('Notification description must be bounded text.');
  if (data.disabled !== undefined && typeof data.disabled !== 'boolean')
    throw new Error('Notification disabled must be boolean.');
  return data;
}

function withValue(data: NativePayload, value: JsonValue): NativePayload {
  if (typeof value !== 'boolean') throw new Error('Notification value must be boolean.');
  return parse({ ...data, value });
}

/** Typed view of validated data; status defaults to info. */
export function readNotification(input: unknown): NotificationData {
  const data = parse(input);
  return {
    value: data.value as boolean,
    message: data.message as string,
    status: (data.status ?? 'info') as NotificationStatus,
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
    ...(typeof data.disabled === 'boolean' ? { disabled: data.disabled } : {}),
  };
}

export const definition: NativeDefinition = {
  name: 'AtlasNotification',
  readOnly: false,
  parse,
  withValue,
};

export const sample: NativePayload = { value: false, message: 'Changes saved' };
