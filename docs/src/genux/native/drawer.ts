import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const allowed = ['label', 'title', 'body', 'placement', 'value', 'disabled'] as const;
const required = ['label', 'title', 'body', 'value'] as const;
const placements = ['left', 'right'] as const;

function text(value: JsonValue | undefined, key: string, max: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`GenUXDrawer.${key}: expected non-empty text up to ${max} characters.`);
}

/** Controlled drawer: `value` is the open state; the host owns it, the adapter only reports. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  text(data.label, 'label', 80);
  text(data.title, 'title', 160);
  text(data.body, 'body', 4096);
  if (typeof data.value !== 'boolean') throw new Error('GenUXDrawer.value: expected boolean.');
  if (
    data.placement !== undefined &&
    !(placements as readonly JsonValue[]).includes(data.placement)
  )
    throw new Error('GenUXDrawer.placement: expected left | right.');
  if (data.disabled !== undefined && typeof data.disabled !== 'boolean')
    throw new Error('GenUXDrawer.disabled: expected boolean.');
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXDrawer',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Open details',
  title: 'Order details',
  body: 'The shipment leaves the warehouse today.',
  placement: 'right',
  value: false,
};
