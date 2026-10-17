import type { JsonValue } from '../contracts';
import {
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const shapes: readonly string[] = ['circle', 'square'];

/** Visible person name; the accessible label and initials fallback derive from it. */
function personName(value: JsonValue | undefined): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 160 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error('GenUXAvatar.name: expected non-empty bounded text.');
  return value;
}

/** Read-only identity: exact keys, safe local/https image source, approved shape. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['name', 'src', 'shape'], ['name']);
  const payload: NativePayload = { name: personName(data.name) };
  if (Object.hasOwn(data, 'src')) payload.src = safeMediaSource(data.src);
  if (Object.hasOwn(data, 'shape')) {
    if (typeof data.shape !== 'string' || !shapes.includes(data.shape))
      throw new Error('GenUXAvatar.shape: expected circle | square.');
    payload.shape = data.shape;
  }
  return payload;
}

export const definition: NativeDefinition = { name: 'GenUXAvatar', readOnly: true, parse };

export const sample: NativePayload = { name: 'Ada Lovelace', shape: 'circle' };
