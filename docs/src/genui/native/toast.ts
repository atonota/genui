import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

export const toastStatuses = ['info', 'success', 'warning', 'error'] as const;
export const toastPlacements = ['top-center', 'top-right-top', 'top-right-right'] as const;
export type ToastStatus = (typeof toastStatuses)[number];
export type ToastPlacement = (typeof toastPlacements)[number];

const allowed = ['label', 'message', 'status', 'placement', 'value', 'disabled'] as const;
const required = ['label', 'message', 'value'] as const;

export interface ToastView {
  label: string;
  message: string;
  status: ToastStatus;
  placement: ToastPlacement;
  value: boolean;
  disabled: boolean;
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`AtlasToast ${name} must be non-empty text up to ${max} characters.`);
  return value;
}

function member<T extends string>(value: unknown, values: readonly T[], name: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
    throw new Error(`AtlasToast ${name} must be one of ${values.join(' | ')}.`);
  return value as T;
}

/** Typed view with defaults; info avoids implying success for generated notices. */
export function readToast(data: NativePayload): ToastView {
  if (typeof data.value !== 'boolean') throw new Error('AtlasToast value must be boolean.');
  if (data.disabled !== undefined && typeof data.disabled !== 'boolean')
    throw new Error('AtlasToast disabled must be boolean.');
  return {
    label: text(data.label, 'label', 80),
    message: text(data.message, 'message', 280),
    status: data.status === undefined ? 'info' : member(data.status, toastStatuses, 'status'),
    placement:
      data.placement === undefined
        ? 'top-center'
        : member(data.placement, toastPlacements, 'placement'),
    value: data.value,
    disabled: data.disabled === true,
  };
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  readToast(data);
  return data;
}

export const definition: NativeDefinition = {
  name: 'AtlasToast',
  readOnly: false,
  parse,
  withValue(data, value) {
    if (typeof value !== 'boolean') throw new Error('AtlasToast value must be boolean.');
    return parse({ ...data, value });
  },
};

export const sample: NativePayload = {
  label: 'Show notice',
  message: 'Review the highlighted fields before sending.',
  value: false,
};
