import type {
  Capability,
  CollectionView,
  FieldDefinition,
  FieldErrors,
  FilterClause,
  FilterOperator,
  GroupDefinition,
  GroupState,
  ProjectionState,
  QueryState,
  RecordIdentity,
} from '../react/workspace/kit/contracts';
import {
  fieldAvailability,
  cloneRecord as cloneGridRecord,
  recordsEqual as gridRecordsEqual,
  fieldFilterOperators as fieldOperators,
  validDateOnly,
  validInstant,
  validateRecord,
} from './field-kit';
export { fieldOperators };

export const FILTER_LABELS: Record<FilterOperator, string> = {
  eq: 'Equals',
  neq: 'Does not equal',
  contains: 'Contains',
  gt: 'Greater than',
  gte: 'At least',
  lt: 'Less than',
  lte: 'At most',
  'is-empty': 'Is empty',
  'is-not-empty': 'Is not empty',
};
export function filterHasNoValue(operator: FilterOperator) {
  return operator === 'is-empty' || operator === 'is-not-empty';
}
export function validateFilterDraft<R extends RecordIdentity>(
  filters: readonly FilterClause[],
  fields: readonly FieldDefinition<R>[],
): Record<string, string> {
  const errors: Record<string, string> = Object.create(null);
  const ids = new Set<string>();
  for (const filter of filters) {
    const field = fields.find(item => item.key === filter.fieldKey);
    if (!filter.id || ids.has(filter.id))
      errors[filter.id] = 'Each filter needs a unique identity.';
    ids.add(filter.id);
    if (!field || !fieldOperators(field).includes(filter.operator)) {
      errors[filter.id] = 'Choose an available field and operator.';
      continue;
    }
    if (filterHasNoValue(filter.operator)) continue;
    const value = filter.value;
    if (value === null || value === undefined || value === '')
      errors[filter.id] = 'Enter a filter value.';
    else if (
      ['number', 'money', 'unit', 'duration'].includes(field.kind) &&
      (typeof value !== 'number' || !Number.isFinite(value))
    )
      errors[filter.id] = 'Enter a finite number.';
    else if (field.kind === 'boolean' && typeof value !== 'boolean')
      errors[filter.id] = 'Choose true or false.';
    else if (
      field.kind === 'choice' &&
      !field.options?.some(option => option.value === value && !option.disabled)
    )
      errors[filter.id] = 'Choose an available option.';
    else if (field.kind === 'date' && (typeof value !== 'string' || !validDateOnly(value)))
      errors[filter.id] = 'Enter a valid date.';
    else if (field.kind === 'datetime' && (typeof value !== 'string' || !validInstant(value)))
      errors[filter.id] = 'Enter a valid date and time.';
  }
  return errors;
}

export type { GroupDefinition } from '../react/workspace/kit/contracts';
export type RecordGroup<R extends RecordIdentity> = Omit<GroupDefinition<R>, 'matches'> & {
  records: readonly R[];
};
export function groupMemberships<R extends RecordIdentity>(
  records: readonly R[],
  definitions: readonly GroupDefinition<R>[],
) {
  const exclusiveClaimed = new Set<string>();
  const unique = new Set<string>();
  let membershipCount = 0;
  const groups = definitions.map(definition => {
    const matches = records.filter(record => {
      if (
        !definition.matches(record) ||
        (definition.kind === 'exclusive' && exclusiveClaimed.has(record.id))
      )
        return false;
      if (definition.kind === 'exclusive') exclusiveClaimed.add(record.id);
      unique.add(record.id);
      membershipCount++;
      return true;
    });
    return { ...definition, records: matches };
  });
  return { groups, uniqueCount: unique.size, membershipCount };
}
export function scopeGroupRecords<R extends RecordIdentity>(
  records: readonly R[],
  groups: readonly RecordGroup<R>[],
  activeId: string | null,
): readonly R[] {
  return activeId === null ? records : (groups.find(group => group.id === activeId)?.records ?? []);
}

export type SavedView = {
  version: 1;
  name: string;
  query: QueryState;
  projection: ProjectionState;
  group: GroupState;
  view: CollectionView;
};
const VIEW_TYPES: readonly CollectionView[] = [
  'table',
  'list',
  'cards',
  'board',
  'calendar',
  'gantt',
  'timeline',
  'tree',
];
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseSavedView<R extends RecordIdentity>(
  json: string,
  fields: readonly FieldDefinition<R>[],
): { value?: SavedView; error?: string } {
  try {
    const value: unknown = JSON.parse(json);
    if (
      !object(value) ||
      Object.keys(value).some(
        key => !['version', 'name', 'query', 'projection', 'group', 'view'].includes(key),
      ) ||
      value.version !== 1 ||
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      value.name.length > 120 ||
      !object(value.query) ||
      Object.keys(value.query).some(key => !['search', 'filters', 'sort'].includes(key)) ||
      typeof value.query.search !== 'string' ||
      !Array.isArray(value.query.filters) ||
      !Array.isArray(value.query.sort) ||
      !Array.isArray(value.projection) ||
      !object(value.group) ||
      Object.keys(value.group).some(key => !['fieldKey', 'activeGroupId'].includes(key)) ||
      (value.group.activeGroupId !== undefined &&
        value.group.activeGroupId !== null &&
        typeof value.group.activeGroupId !== 'string') ||
      !VIEW_TYPES.includes(value.view as CollectionView)
    )
      return { error: 'Invalid saved view settings.' };
    const keys = new Set(fields.map(field => field.key));
    const groupFieldKey = value.group.fieldKey;
    if (
      (fields.some(field => field.key !== 'id') && value.projection.length === 0) ||
      value.projection.includes('id')
    )
      return {
        error: 'Choose at least one visible data field; record identity is included separately.',
      };
    if (
      groupFieldKey !== null &&
      fields.some(
        field => field.key === groupFieldKey && (field.key === 'id' || field.kind === 'multiline'),
      )
    )
      return { error: 'Choose an eligible grouping field.' };
    if (
      value.projection.some(key => typeof key !== 'string' || !keys.has(key)) ||
      new Set(value.projection).size !== value.projection.length ||
      (value.group.fieldKey !== null &&
        (typeof value.group.fieldKey !== 'string' || !keys.has(value.group.fieldKey)))
    )
      return { error: 'The saved view refers to unavailable fields.' };
    if (
      value.query.sort.some(
        sort =>
          !object(sort) ||
          Object.keys(sort).some(key => !['fieldKey', 'direction'].includes(key)) ||
          typeof sort.fieldKey !== 'string' ||
          !keys.has(sort.fieldKey) ||
          !['asc', 'desc'].includes(String(sort.direction)),
      ) ||
      new Set(value.query.sort.map(sort => sort.fieldKey)).size !== value.query.sort.length
    )
      return { error: 'Invalid saved sort settings.' };
    if (
      value.query.filters.some(
        filter =>
          !object(filter) ||
          Object.keys(filter).some(key => !['id', 'fieldKey', 'operator', 'value'].includes(key)) ||
          typeof filter.id !== 'string' ||
          typeof filter.fieldKey !== 'string' ||
          !keys.has(filter.fieldKey) ||
          typeof filter.operator !== 'string' ||
          !Object.hasOwn(FILTER_LABELS, filter.operator) ||
          (filter.value !== undefined &&
            filter.value !== null &&
            !['string', 'number', 'boolean'].includes(typeof filter.value)),
      )
    )
      return { error: 'Invalid saved filter settings.' };
    const candidate = value as unknown as SavedView;
    if (Object.keys(validateFilterDraft(candidate.query.filters, fields)).length)
      return { error: 'Invalid saved filter values.' };
    return { value: candidate };
  } catch {
    return { error: 'Enter valid saved view JSON.' };
  }
}

export type GridDrafts<R extends RecordIdentity> = Readonly<Record<string, R>>;
export type GridErrors = Readonly<Record<string, FieldErrors>>;
export type GridCapability<R extends RecordIdentity> = Capability | ((record: R) => Capability);
export function gridCapabilityFor<R extends RecordIdentity>(
  record: R,
  capability?: GridCapability<R>,
): Capability {
  return typeof capability === 'function' ? capability(record) : (capability ?? { allowed: true });
}
export { recordsEqual as gridRecordsEqual, cloneRecord as cloneGridRecord } from './field-kit';
function gridReadable<R extends RecordIdentity>(record: R, field: FieldDefinition<R>): boolean {
  return fieldAvailability(record, field).state === 'available';
}
function authorizedGridDraft<R extends RecordIdentity>(
  original: R,
  draft: R,
  fields: readonly FieldDefinition<R>[],
  capability?: GridCapability<R>,
): R {
  let candidate = cloneGridRecord(original);
  if (!gridCapabilityFor(original, capability).allowed) return candidate;
  for (const field of fields) {
    if (
      !field.setValue ||
      !gridReadable(original, field) ||
      !gridReadable(draft, field) ||
      field.editable?.(original).allowed === false ||
      field.editable?.(draft).allowed === false
    )
      continue;
    const before = field.getValue(original);
    const after = field.getValue(draft);
    if (!Object.is(before, after)) candidate = field.setValue(candidate, after);
  }
  return candidate;
}
export function validateGridDrafts<R extends RecordIdentity>(
  records: readonly R[],
  drafts: GridDrafts<R>,
  fields: readonly FieldDefinition<R>[],
  capability?: GridCapability<R>,
  baselines: GridDrafts<R> = {},
): GridErrors {
  const errors: Record<string, Record<string, string>> = Object.create(null);
  for (const [id, draft] of Object.entries(drafts)) {
    const original = records.find(record => record.id === id);
    const rowErrors: Record<string, string> = Object.create(null);
    if (!original || draft.id !== id) rowErrors.id = 'The draft record identity is not valid.';
    else if (baselines[id] && !gridRecordsEqual(original, baselines[id])) {
      rowErrors.$record =
        'The record changed after this draft began. Review the latest record before committing.';
    } else {
      // An untrusted draft cannot make an originally unreadable field readable.
      const readable = fields.filter(
        field => gridReadable(original, field) && gridReadable(draft, field),
      );
      Object.assign(rowErrors, validateRecord(draft, readable));
      const allowed = gridCapabilityFor(original, capability);
      if (!allowed.allowed) rowErrors.id = allowed.reason ?? 'This record is read-only.';
      const candidate = authorizedGridDraft(original, draft, fields, capability);
      for (const field of readable) {
        if (
          (!field.setValue || field.editable?.(original).allowed === false || !allowed.allowed) &&
          gridReadable(candidate, field) &&
          !Object.is(field.getValue(candidate), field.getValue(draft))
        )
          rowErrors[field.key] = field.editable?.(original).reason ?? 'This value is read-only.';
      }
      if (!gridRecordsEqual(candidate, draft))
        rowErrors.id ??= 'The draft changes values outside the editable field contract.';
    }
    if (Object.keys(rowErrors).length) errors[id] = rowErrors;
  }
  return errors;
}
export function prepareGridCommit<R extends RecordIdentity>(
  records: readonly R[],
  drafts: GridDrafts<R>,
  fields: readonly FieldDefinition<R>[],
  capability?: GridCapability<R>,
  baselines: GridDrafts<R> = {},
): { records: readonly R[]; errors: GridErrors } {
  const errors = validateGridDrafts(records, drafts, fields, capability, baselines);
  return {
    records: Object.keys(errors).length
      ? []
      : records
          .filter(record => Object.hasOwn(drafts, record.id))
          .map(record =>
            cloneGridRecord(authorizedGridDraft(record, drafts[record.id], fields, capability)),
          ),
    errors,
  };
}

/** Projection is ordered, excludes the mandatory identity column, and never loses every data field. */
export function projectedFields<R extends RecordIdentity>(
  fields: readonly FieldDefinition<R>[],
  projection: ProjectionState,
): FieldDefinition<R>[] {
  const used = new Set<string>();
  const result = projection
    .map(key => fields.find(field => field.key === key))
    .filter((field): field is FieldDefinition<R> => {
      if (!field || field.key === 'id' || used.has(field.key)) return false;
      used.add(field.key);
      return true;
    });
  return result.length ? result : fields.filter(field => field.key !== 'id').slice(0, 1);
}
/** Bounded local pagination does not claim remote totals or virtualization. */
export function collectionPage<R>(records: readonly R[], requestedPage = 1, requestedSize = 25) {
  const size = Number.isFinite(requestedSize)
    ? Math.min(100, Math.max(1, Math.floor(requestedSize)))
    : 25;
  const pages = Math.max(1, Math.ceil(records.length / size));
  const page = Number.isFinite(requestedPage)
    ? Math.min(pages, Math.max(1, Math.floor(requestedPage)))
    : 1;
  const start = (page - 1) * size;
  return {
    records: records.slice(start, start + size),
    page,
    pages,
    size,
    start,
    end: Math.min(start + size, records.length),
  };
}
