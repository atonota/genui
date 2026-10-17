import type { JsonValue } from '../contracts';
import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';
import {
  nativeFieldDefinitions,
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
  type NativeRecordField,
} from './record-fields';
import { validateFilterDraft } from '../../data/collection-kit';
import type {
  CollectionView,
  FilterClause,
  QueryState,
  SortClause,
} from '../../react/workspace/kit/contracts';

export type NativeCollectionValue = Readonly<{
  query: QueryState;
  projection: readonly string[];
  activeId: string | null;
  checkedIds: readonly string[];
  view: CollectionView;
  page: number;
}>;
type FieldRole =
  | 'dateFieldKey'
  | 'startFieldKey'
  | 'endFieldKey'
  | 'boardFieldKey'
  | 'parentFieldKey';
export type NativeCollection = Readonly<
  {
    title?: string;
    fields: readonly NativeRecordField[];
    records: readonly NativeRecord[];
    value: NativeCollectionValue;
    views: readonly CollectionView[];
    pageSize: number;
  } & Partial<Record<FieldRole, string>>
>;

const VIEWS: readonly CollectionView[] = [
  'table',
  'list',
  'cards',
  'board',
  'calendar',
  'gantt',
  'timeline',
  'tree',
];
// Each optional key names a supplied field of an eligible kind; views never infer fields.
const FIELD_ROLES: Readonly<Record<FieldRole, readonly string[]>> = {
  dateFieldKey: ['date', 'datetime'],
  startFieldKey: ['date', 'datetime'],
  endFieldKey: ['date', 'datetime'],
  boardFieldKey: ['choice', 'entity', 'boolean'],
  parentFieldKey: ['text', 'entity'],
};
const PAYLOAD_KEYS = [
  'title',
  'fields',
  'records',
  'value',
  'supportedViews',
  'pageSize',
  ...Object.keys(FIELD_ROLES),
];
const VALUE_KEYS = ['query', 'projection', 'activeId', 'checkedIds', 'view', 'page'];
const MAX_FILTERS = 24;
const MAX_SEARCH = 200;

function exactObject(value: unknown, keys: readonly string[], label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new Error(`${label} property ${key} is not approved.`);
  return value as Record<string, unknown>;
}
function uniqueMembers(value: unknown, allowed: ReadonlySet<string>, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some(item => typeof item !== 'string' || !allowed.has(item)) ||
    new Set(value).size !== value.length
  )
    throw new Error(`${label} must list unique supplied identities.`);
  return value as string[];
}
function availableViews(roles: Partial<Record<FieldRole, string>>, parentAvailable: boolean) {
  return VIEWS.filter(view => {
    if (view === 'board') return !!roles.boardFieldKey;
    if (view === 'calendar' || view === 'timeline') return !!roles.dateFieldKey;
    if (view === 'gantt') return !!roles.startFieldKey && !!roles.endFieldKey;
    if (view === 'tree') return parentAvailable;
    return true;
  });
}
function parseFilters(input: unknown, fields: readonly NativeRecordField[]): FilterClause[] {
  if (!Array.isArray(input) || input.length > MAX_FILTERS)
    throw new Error('Collection filters are invalid.');
  const keys = new Set(fields.map(field => field.key));
  const filters = input.map(item => {
    const filter = exactObject(item, ['id', 'fieldKey', 'operator', 'value'], 'Collection filter');
    if (
      typeof filter.id !== 'string' ||
      !filter.id ||
      filter.id.length > 80 ||
      /\p{Cc}/u.test(filter.id) ||
      typeof filter.fieldKey !== 'string' ||
      !keys.has(filter.fieldKey) ||
      typeof filter.operator !== 'string' ||
      (filter.value !== undefined &&
        filter.value !== null &&
        !['string', 'number', 'boolean'].includes(typeof filter.value))
    )
      throw new Error('Collection filter is invalid.');
    return filter as unknown as FilterClause;
  });
  const errors = validateFilterDraft(filters, nativeFieldDefinitions(fields));
  const error = Object.values(errors)[0];
  if (error) throw new Error(error);
  return filters;
}
function parseSort(input: unknown, fields: readonly NativeRecordField[]): SortClause[] {
  if (!Array.isArray(input) || input.length > fields.length)
    throw new Error('Collection sort is invalid.');
  const keys = new Set(fields.map(field => field.key));
  const sort = input.map(item => {
    const clause = exactObject(item, ['fieldKey', 'direction'], 'Collection sort');
    if (
      typeof clause.fieldKey !== 'string' ||
      !keys.has(clause.fieldKey) ||
      (clause.direction !== 'asc' && clause.direction !== 'desc')
    )
      throw new Error('Collection sort is invalid.');
    return clause as unknown as SortClause;
  });
  if (new Set(sort.map(clause => clause.fieldKey)).size !== sort.length)
    throw new Error('Each field can be sorted once.');
  return sort;
}
function parseValue(
  input: unknown,
  fields: readonly NativeRecordField[],
  records: readonly NativeRecord[],
  views: readonly CollectionView[],
  pageSize: number,
): NativeCollectionValue {
  const value = exactObject(input, VALUE_KEYS, 'Collection value');
  for (const key of VALUE_KEYS)
    if (!Object.hasOwn(value, key)) throw new Error(`Collection value ${key} is required.`);
  const query = exactObject(value.query, ['search', 'filters', 'sort'], 'Collection query');
  if (typeof query.search !== 'string' || query.search.length > MAX_SEARCH)
    throw new Error('Collection search is invalid.');
  parseFilters(query.filters, fields);
  parseSort(query.sort, fields);
  const dataKeys = new Set(fields.filter(field => field.key !== 'id').map(field => field.key));
  const projection = uniqueMembers(value.projection, dataKeys, 'Collection projection');
  if (dataKeys.size > 0 && projection.length === 0)
    throw new Error('Choose at least one visible data field.');
  const ids = new Set(records.map(record => record.id));
  if (value.activeId !== null && (typeof value.activeId !== 'string' || !ids.has(value.activeId)))
    throw new Error('The active record is not in the collection.');
  uniqueMembers(value.checkedIds, ids, 'Checked records');
  if (!views.includes(value.view as CollectionView))
    throw new Error('This view is not available for the supplied fields.');
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  if (!Number.isInteger(value.page) || (value.page as number) < 1 || (value.page as number) > pages)
    throw new Error('Collection page is out of range.');
  return value as unknown as NativeCollectionValue;
}

function readCollection(input: unknown): { payload: NativePayload; collection: NativeCollection } {
  const payload = nativeRecord(input, PAYLOAD_KEYS, ['fields', 'records', 'value']);
  if (
    payload.title !== undefined &&
    (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 120)
  )
    throw new Error('Collection title is invalid.');
  const fields = parseNativeFields(payload.fields);
  const records = parseNativeRecords(payload.records, fields);
  const roles: Partial<Record<FieldRole, string>> = {};
  for (const [role, kinds] of Object.entries(FIELD_ROLES) as [FieldRole, readonly string[]][]) {
    const key = payload[role];
    if (key === undefined) continue;
    const field = fields.find(item => item.key === key);
    if (!field || !kinds.includes(field.kind))
      throw new Error(`${role} must name a supplied ${kinds.join(' or ')} field.`);
    roles[role] = field.key;
  }
  const available = availableViews(roles, !!roles.parentFieldKey);
  const views =
    payload.supportedViews === undefined
      ? available
      : (uniqueMembers(
          payload.supportedViews,
          new Set(available),
          'Supported views',
        ) as CollectionView[]);
  if (!views.length) throw new Error('Supply at least one available view.');
  const pageSize = payload.pageSize ?? 25;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 100)
    throw new Error('Collection page size must be between 1 and 100.');
  const value = parseValue(payload.value, fields, records, views, pageSize as number);
  return {
    payload,
    collection: {
      ...roles,
      title: payload.title as string | undefined,
      fields,
      records,
      value,
      views,
      pageSize: pageSize as number,
    },
  };
}

/** Validated, typed view of a parsed payload for the trusted adapter. */
export function nativeCollection(data: NativePayload): NativeCollection {
  return readCollection(data).collection;
}

export const definition: NativeDefinition & { containsCards?: boolean } = {
  name: 'GenUXRecordCollection',
  readOnly: false,
  // Cards and board views render peer entity cards.
  containsCards: true,
  parse: input => readCollection(input).payload,
  withValue: (data: NativePayload, value: JsonValue) => readCollection({ ...data, value }).payload,
};

export const sample: NativePayload = {
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'status',
      label: 'Status',
      kind: 'choice',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'done', label: 'Done' },
      ],
    },
    { key: 'due', label: 'Due date', kind: 'date' },
  ],
  records: [
    { id: 'task-1', name: 'Draft brief', status: 'open', due: '2026-10-20' },
    { id: 'task-2', name: 'Review copy', status: 'done', due: '2026-10-22' },
    { id: 'task-3', name: 'Publish notes', status: 'open', due: '2026-11-02' },
  ],
  dateFieldKey: 'due',
  boardFieldKey: 'status',
  value: {
    query: { search: '', filters: [], sort: [{ fieldKey: 'due', direction: 'asc' }] },
    projection: ['name', 'status', 'due'],
    activeId: null,
    checkedIds: ['task-1'],
    view: 'table',
    page: 1,
  },
};
