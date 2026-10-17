import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

export type UploadMetadata = { name: string; type: string; size: number };
export type UploadSettings = {
  label: string;
  accept: string | undefined;
  maxBytes: number | undefined;
  multiple: boolean;
  disabled: boolean;
  value: UploadMetadata[];
};

const KEYS = ['label', 'accept', 'maxBytes', 'multiple', 'disabled', 'value'] as const;
const REQUIRED = ['label', 'value'] as const;
const FILE_KEYS = ['name', 'type', 'size'] as const;
const MAX_FILES = 24;
const control = /[\u0000-\u001f\u007f]/;
const acceptRules = /^\s*[\w.*+/-]+\s*(?:,\s*[\w.*+/-]+\s*)*$/;
const mime = /^(?:[\w!#$&^.+-]+\/[\w!#$&^.+-]+)?$/;

function fail(path: string): never {
  throw new Error(`GenUXUpload ${path} is invalid.`);
}
function text(value: JsonValue | undefined, path: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || control.test(value))
    fail(path);
  return value;
}
function byteCount(value: JsonValue | undefined, path: string, min: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > Number.MAX_SAFE_INTEGER
  )
    fail(path);
  return value;
}
function flag(value: JsonValue | undefined, path: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') fail(path);
  return value;
}

// Metadata only: a File, blob or its contents can never be part of the model.
function metadata(input: JsonValue, index: number, maxBytes: number | undefined): UploadMetadata {
  const file = nativeRecord(input, FILE_KEYS, FILE_KEYS);
  const path = `value[${index}]`;
  const type = file.type;
  if (typeof type !== 'string' || type.length > 127 || !mime.test(type)) fail(`${path}.type`);
  const size = byteCount(file.size, `${path}.size`, 0);
  if (maxBytes !== undefined && size > maxBytes) fail(`${path}.size`);
  return { name: text(file.name, `${path}.name`, 255), type, size };
}

/** Typed view of a payload already reduced to its approved keys by nativeRecord. */
export function uploadSettings(data: NativePayload): UploadSettings {
  const accept = data.accept;
  if (
    accept !== undefined &&
    (typeof accept !== 'string' || accept.length > 256 || !acceptRules.test(accept))
  )
    fail('accept');
  const maxBytes =
    data.maxBytes === undefined ? undefined : byteCount(data.maxBytes, 'maxBytes', 1);
  const multiple = flag(data.multiple, 'multiple');
  const value = data.value;
  if (!Array.isArray(value) || value.length > (multiple ? MAX_FILES : 1)) fail('value');
  return {
    label: text(data.label, 'label', 200),
    accept,
    maxBytes,
    multiple,
    disabled: flag(data.disabled, 'disabled'),
    value: value.map((file, index) => metadata(file, index, maxBytes)),
  };
}

function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, KEYS, REQUIRED);
  uploadSettings(data);
  return data;
}

export const definition: NativeDefinition = {
  name: 'GenUXUpload',
  readOnly: false,
  parse,
  withValue: (data, value) => parse({ ...data, value }),
};

export const sample: NativePayload = {
  label: 'Attach evidence',
  accept: '.txt,text/plain',
  maxBytes: 1048576,
  multiple: false,
  value: [],
};
