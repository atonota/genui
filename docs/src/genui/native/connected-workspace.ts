import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';
import {
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
  type NativeRecordField,
} from './record-fields';

/** Presentations that need no date, hierarchy or board field mapping. */
export const CONNECTED_VIEWS = ['table', 'list', 'cards'] as const;
export type ConnectedWorkspaceView = (typeof CONNECTED_VIEWS)[number];

/**
 * The only mutable state: a JSON preview value. `records` is the local preview copy after an
 * explicit commit; the supplied `records` remain the untouched host source.
 */
export interface ConnectedWorkspaceValue {
  activeId: string | null;
  checkedIds: string[];
  view: ConnectedWorkspaceView;
  draft: NativeRecord | null;
  records?: NativeRecord[];
}
export interface ConnectedWorkspaceData {
  label?: string;
  fields: NativeRecordField[];
  records: NativeRecord[];
  value: ConnectedWorkspaceValue;
}

const PAYLOAD_KEYS = ['label', 'fields', 'records', 'value'] as const;
const VALUE_KEYS = ['activeId', 'checkedIds', 'view', 'draft', 'records'] as const;

function parseValue(
  input: unknown,
  fields: readonly NativeRecordField[],
  host: readonly NativeRecord[],
): ConnectedWorkspaceValue {
  if (input === undefined) return { activeId: null, checkedIds: [], view: 'table', draft: null };
  const value = nativeRecord(input, VALUE_KEYS, []);
  const records =
    value.records === undefined ? undefined : parseNativeRecords(value.records, fields);
  // A local preview may change values, never invent, drop or reorder supplied records.
  if (
    records &&
    records.map(record => record.id).join('\n') !== host.map(record => record.id).join('\n')
  )
    throw new Error('Connected preview records must keep the supplied record identities.');
  // Read-only fields stay at the host value; editable fields remain free to change.
  const locked = fields.filter(field => field.readOnly);
  const keepsLocked = (next: NativeRecord, base: NativeRecord | undefined) =>
    !!base && locked.every(field => next[field.key] === base[field.key]);
  if (records && records.some((record, index) => !keepsLocked(record, host[index])))
    throw new Error('Connected preview cannot change read-only fields.');
  const ids = new Set((records ?? host).map(record => record.id));
  const activeId = value.activeId ?? null;
  if (activeId !== null && (typeof activeId !== 'string' || !ids.has(activeId)))
    throw new Error('Connected active record is invalid.');
  const checkedIds = value.checkedIds ?? [];
  if (
    !Array.isArray(checkedIds) ||
    checkedIds.some(id => typeof id !== 'string' || !ids.has(id)) ||
    new Set(checkedIds).size !== checkedIds.length
  )
    throw new Error('Connected checked records are invalid.');
  const view = value.view ?? 'table';
  if (typeof view !== 'string' || !(CONNECTED_VIEWS as readonly string[]).includes(view))
    throw new Error('Connected view is not approved.');
  const draft =
    value.draft === undefined || value.draft === null
      ? null
      : parseNativeRecords([value.draft], fields, 1)[0]!;
  if (draft && !ids.has(draft.id))
    throw new Error('Connected draft must belong to a supplied record.');
  if (
    draft &&
    !keepsLocked(
      draft,
      host.find(record => record.id === draft.id),
    )
  )
    throw new Error('Connected draft cannot change read-only fields.');
  return {
    activeId,
    checkedIds: checkedIds as string[],
    view: view as ConnectedWorkspaceView,
    draft,
    ...(records ? { records } : {}),
  };
}

export function readConnectedWorkspace(input: unknown): ConnectedWorkspaceData {
  const payload = nativeRecord(input, PAYLOAD_KEYS, ['fields', 'records']);
  if (
    payload.label !== undefined &&
    (typeof payload.label !== 'string' || !payload.label.trim() || payload.label.length > 200)
  )
    throw new Error('Connected workspace label is invalid.');
  const fields = parseNativeFields(payload.fields);
  const records = parseNativeRecords(payload.records, fields);
  return {
    ...(payload.label !== undefined ? { label: payload.label as string } : {}),
    fields,
    records,
    value: parseValue(payload.value, fields, records),
  };
}

const serialize = (data: ConnectedWorkspaceData): NativePayload => ({
  ...(data.label !== undefined ? { label: data.label } : {}),
  fields: data.fields as unknown as JsonValue,
  records: data.records as unknown as JsonValue,
  value: data.value as unknown as JsonValue,
});

export function withConnectedValue(data: NativePayload, value: JsonValue): NativePayload {
  const current = readConnectedWorkspace(data);
  return serialize(readConnectedWorkspace({ ...serialize(current), value }));
}

export const definition: NativeDefinition & { containsCards?: boolean } = {
  name: 'AtlasConnectedWorkspace',
  readOnly: false,
  containsCards: true,
  parse: input => serialize(readConnectedWorkspace(input)),
  withValue: withConnectedValue,
};

export const sample: NativePayload = {
  label: 'Local order preview',
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'quantity', label: 'Quantity', kind: 'number', precision: 0 },
    {
      key: 'status',
      label: 'Status',
      kind: 'choice',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'ready', label: 'Ready' },
      ],
    },
  ],
  records: [
    { id: 'ord-1', title: 'Hinge order', quantity: 12, status: 'ready' },
    { id: 'ord-2', title: 'Bracket order', quantity: 4, status: 'draft' },
  ],
  value: { activeId: null, checkedIds: [], view: 'table', draft: null },
};
