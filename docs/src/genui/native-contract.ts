import type { JsonValue } from './contracts';

export type NativePayload = Record<string, JsonValue>;
export interface NativeDefinition {
  name: string;
  readOnly: boolean;
  parse(input: unknown): NativePayload;
  withValue?: (data: NativePayload, value: JsonValue) => NativePayload;
  /** Code-owned metadata, never a payload property: the native renders peer Cards. */
  containsCards?: boolean;
}
export interface NativeAdapterProps {
  data: NativePayload;
  disabled: boolean;
  /** Whether a registered outer action is currently available. */
  actionAvailable?: boolean;
  onChange(value: JsonValue): void;
  onAction(): void;
}

// The JSON guard and identifier check sit below policy and every native schema
// module, so schemas can use them without an initialization cycle through the
// native registry.
export const GENUI_LIMITS = Object.freeze({
  bytes: 65536,
  depth: 20,
  nodes: 80,
  commands: 32,
  surfaces: 8,
  text: 4096,
  history: 16,
  events: 100,
});
export const UNSAFE_JSON_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);
const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
export function assertId(value: unknown, label = 'ID'): asserts value is string {
  if (typeof value !== 'string' || !identifier.test(value)) throw new Error(`${label} is invalid.`);
}
/**
 * Reject accessors without evaluating them, host objects (including arrays with a
 * non-default prototype), inherited toJSON, sparse arrays, cycles and oversized JSON.
 * With foreign prototypes and inherited toJSON rejected, the final JSON.stringify size
 * check cannot invoke an untrusted toJSON.
 */
export function assertPlainJSON(value: unknown): asserts value is JsonValue {
  let count = 0;
  let size = 0;
  const active = new WeakSet<object>();
  const visit = (item: unknown, depth: number): void => {
    if (++count > 6000 || depth > GENUI_LIMITS.depth)
      throw new Error('Payload complexity limit exceeded.');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string') {
      size += new TextEncoder().encode(item).byteLength;
      if (item.length > GENUI_LIMITS.text || size > GENUI_LIMITS.bytes)
        throw new Error('Payload text limit exceeded.');
      return;
    }
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object')
      throw new Error('Only finite plain JSON values are accepted.');
    if (active.has(item)) throw new Error('Cyclic JSON is not accepted.');
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (
      array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
    )
      throw new Error('Host objects are not accepted.');
    // `in` walks the approved prototype chain without invoking accessors.
    if (!Object.hasOwn(item, 'toJSON') && 'toJSON' in item)
      throw new Error('Inherited toJSON is not accepted.');
    if (array && item.length > 256) throw new Error('Array limit exceeded.');
    // Own keys skip holes, and schema iteration (some/every) skips them too, so a
    // hole would otherwise pass validation and serialize as null.
    if (array)
      for (let index = 0; index < item.length; index++)
        if (!Object.hasOwn(item, index)) throw new Error('Sparse arrays are not accepted.');
    const keys = Reflect.ownKeys(item);
    if (keys.length > 256) throw new Error('Object key limit exceeded.');
    active.add(item);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (
        typeof key !== 'string' ||
        UNSAFE_JSON_KEYS.has(key) ||
        (array && !/^(0|[1-9]\d*)$/.test(key))
      )
        throw new Error('Unsafe JSON key.');
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!('value' in descriptor)) throw new Error('Accessors are not accepted.');
      // Object.keys and structuredClone skip hidden keys, so a non-enumerable value
      // would pass validation and then silently disappear from the accepted copy.
      if (descriptor.enumerable !== true)
        throw new Error('Non-enumerable properties are not accepted.');
      size += key.length + 4;
      if (size > GENUI_LIMITS.bytes) throw new Error('Payload byte limit exceeded.');
      visit(descriptor.value, depth + 1);
    }
    active.delete(item);
  };
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > GENUI_LIMITS.bytes)
    throw new Error('Payload byte limit exceeded.');
}

/** Accept a plain JSON record with only approved keys and every required own key. */
export function nativeRecord(
  input: unknown,
  allowed: readonly string[],
  required: readonly string[],
): NativePayload {
  assertPlainJSON(input);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Native payload must be an object.');
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) throw new Error(`Native property ${key} is not approved.`);
  for (const key of required)
    if (!Object.hasOwn(input, key)) throw new Error(`Native property ${key} is required.`);
  return structuredClone(input) as NativePayload;
}

/** Same-origin root paths or credential-free HTTPS URLs; every other scheme is rejected. */
export function safeMediaSource(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\p{Cc}\\]/u.test(value))
    throw new Error('Media source is invalid.');
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Media source is invalid.');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Media source must be same-origin or credential-free HTTPS.');
  return value;
}
