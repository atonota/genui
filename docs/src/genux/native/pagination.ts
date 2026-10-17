import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

export const PAGINATION_LIMITS = Object.freeze({ total: 1_000_000_000, pageSize: 100, label: 120 });
const allowed = ['value', 'total', 'pageSize', 'label', 'disabled', 'readOnly'] as const;
const required = ['value', 'total', 'pageSize'] as const;

function integer(value: JsonValue | undefined, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Pagination ${label} is invalid.`);
  return value;
}

/** Controlled page within the declared item range; page size is fixed by the payload. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, allowed, required);
  const total = integer(data.total, 0, PAGINATION_LIMITS.total, 'total');
  const pageSize = integer(data.pageSize, 1, PAGINATION_LIMITS.pageSize, 'page size');
  integer(data.value, 1, Math.max(1, Math.ceil(total / pageSize)), 'page');
  const label = data.label;
  if (
    label !== undefined &&
    (typeof label !== 'string' || !label.trim() || label.length > PAGINATION_LIMITS.label)
  )
    throw new Error('Pagination label is invalid.');
  for (const key of ['disabled', 'readOnly'])
    if (data[key] !== undefined && typeof data[key] !== 'boolean')
      throw new Error(`Pagination ${key} is invalid.`);
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXPagination',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = { value: 2, total: 48, pageSize: 10, label: 'Order pages' };
