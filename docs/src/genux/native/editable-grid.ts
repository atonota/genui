import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';
import {
  nativeFieldDefinitions,
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
  type NativeRecordField,
} from './record-fields';
import { validateGridDrafts } from '../../data/collection-kit';

export type NativeGridModel = {
  title?: string;
  fields: NativeRecordField[];
  records: NativeRecord[];
  drafts: Record<string, NativeRecord>;
  readOnly: boolean;
  pageSize?: number;
};

const GRID_KEYS = ['title', 'fields', 'records', 'value', 'readOnly', 'pageSize'] as const;

/**
 * Drafts are local JSON values keyed by an existing record ID. Field-level validation
 * errors stay in the draft for the grid to present; identity, baseline and
 * read-only contract violations are rejected outright.
 */
export function parseNativeGrid(input: unknown): NativeGridModel {
  const data = nativeRecord(input, GRID_KEYS, ['fields', 'records', 'value']);
  const title = data.title;
  if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 120))
    throw new Error('Editable grid title is invalid.');
  if (data.readOnly !== undefined && typeof data.readOnly !== 'boolean')
    throw new Error('Editable grid readOnly must be a boolean.');
  const pageSize = data.pageSize;
  if (
    pageSize !== undefined &&
    (typeof pageSize !== 'number' || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
  )
    throw new Error('Editable grid page size is invalid.');
  const readOnly = data.readOnly === true;
  const fields = parseNativeFields(data.fields);
  const records = parseNativeRecords(data.records, fields);
  const value = data.value;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Editable grid drafts must be an object keyed by record ID.');
  const entries = Object.entries(value);
  if (readOnly && entries.length) throw new Error('A read-only editable grid cannot hold drafts.');
  const drafts: Record<string, NativeRecord> = {};
  if (entries.length) {
    const parsed = parseNativeRecords(
      entries.map(([, draft]) => draft),
      fields,
      records.length,
    );
    entries.forEach(([id], index) => {
      if (parsed[index].id !== id)
        throw new Error(`Draft ${id} does not match its record identity.`);
      drafts[id] = parsed[index];
    });
    const errors = validateGridDrafts(records, drafts, nativeFieldDefinitions(fields, !readOnly));
    for (const [id, row] of Object.entries(errors))
      if (row.id || row.$record)
        throw new Error(`Draft ${id} is outside the editable grid contract.`);
  }
  return {
    ...(title !== undefined ? { title } : {}),
    fields,
    records,
    drafts,
    readOnly,
    ...(pageSize !== undefined ? { pageSize } : {}),
  };
}

function serializeNativeGrid(model: NativeGridModel): NativePayload {
  return {
    ...(model.title !== undefined ? { title: model.title } : {}),
    fields: model.fields as unknown as JsonValue,
    records: model.records as unknown as JsonValue,
    value: model.drafts as unknown as JsonValue,
    ...(model.readOnly ? { readOnly: true } : {}),
    ...(model.pageSize !== undefined ? { pageSize: model.pageSize } : {}),
  };
}

export const definition: NativeDefinition = {
  name: 'GenUXEditableGrid',
  readOnly: false,
  parse: input => serializeNativeGrid(parseNativeGrid(input)),
  withValue(data, value) {
    if (parseNativeGrid(data).readOnly) throw new Error('Editable grid is read-only.');
    return serializeNativeGrid(parseNativeGrid({ ...data, value }));
  },
};

export const sample: NativePayload = {
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'code', label: 'Code', kind: 'text', readOnly: true },
  ],
  records: [
    { id: 'r1', name: 'Aster', code: 'A-1' },
    { id: 'r2', name: 'Birch', code: 'B-2' },
  ],
  value: {},
};
