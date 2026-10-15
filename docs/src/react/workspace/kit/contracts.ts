import type { ReactNode } from 'react';

export type RecordIdentity = { id: string };
export type FieldScalar = string | number | boolean | null;
export type FieldKind =
  | 'text'
  | 'multiline'
  | 'number'
  | 'money'
  | 'unit'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'boolean'
  | 'choice'
  | 'entity';
export type FieldAvailability = Readonly<{
  state: 'available' | 'restricted' | 'unavailable' | 'not-applicable' | 'unknown';
  reason?: string;
}>;
export type FieldOption = Readonly<{
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}>;
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is-empty'
  | 'is-not-empty';
export type FieldDefinition<R extends RecordIdentity> = Readonly<{
  key: string;
  label: string;
  kind: FieldKind;
  getValue: (record: R) => FieldScalar;
  setValue?: (record: R, value: FieldScalar) => R;
  required?: boolean;
  help?: string;
  section?: string;
  validate?: (value: FieldScalar, record: R) => string | null;
  precision?: number;
  currency?: string | ((record: R) => string);
  unit?: string | ((record: R) => string);
  timezone?: string;
  options?: readonly FieldOption[];
  filterOperators?: readonly FilterOperator[];
  availability?: (record: R) => FieldAvailability;
  /** Optional presentation-only identity paired with available values; never filtered, sorted, edited or serialized. */
  identity?: (record: R) => Readonly<{ name: string; src?: string }>;
  editable?: (record: R) => Capability;
}>;
export type FilterClause = Readonly<{
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value?: FieldScalar;
}>;
export type SortClause = Readonly<{ fieldKey: string; direction: 'asc' | 'desc' }>;
export type QueryState = Readonly<{
  search: string;
  filters: readonly FilterClause[];
  sort: readonly SortClause[];
}>;
export type ProjectionState = readonly string[];
export type GroupState = Readonly<{ fieldKey: string | null; activeGroupId?: string | null }>;
export type GroupDefinition<R extends RecordIdentity> = Readonly<{
  id: string;
  label: string;
  kind: 'exclusive' | 'overlapping';
  matches: (record: R) => boolean;
}>;
export type Capability = Readonly<{ allowed: boolean; reason?: string }>;
export type RecordCapabilities = Readonly<{
  create?: Capability;
  edit?: Capability;
  remove?: Capability;
}>;
export type SurfaceState = Readonly<{
  kind:
    | 'ready'
    | 'loading'
    | 'empty'
    | 'no-match'
    | 'error'
    | 'not-found'
    | 'denied'
    | 'partial'
    | 'stale'
    | 'unknown';
  message?: string;
  recoveryLabel?: string;
  onRecover?: () => void;
}>;
export const isReadableSurface = (state?: SurfaceState): boolean =>
  !state || ['ready', 'partial', 'stale'].includes(state.kind);

export type OperationState = Readonly<{
  kind: 'idle' | 'pending' | 'success' | 'error' | 'partial' | 'unknown';
  message?: string;
  appliedIds?: readonly string[];
  failedIds?: readonly string[];
}>;
export type FieldErrors = Readonly<Record<string, string>>;
export type CollectionView =
  | 'table'
  | 'list'
  | 'cards'
  | 'board'
  | 'calendar'
  | 'gantt'
  | 'timeline'
  | 'tree';
export type CollectionColumn = Readonly<{
  key: string;
  label: string;
  fieldKeys: readonly string[];
}>;
export type RecordCollectionProps<R extends RecordIdentity> = Readonly<{
  records: readonly R[];
  fields: readonly FieldDefinition<R>[];
  columns?: readonly CollectionColumn[];
  query: QueryState;
  onQueryChange: (query: QueryState) => void;
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
  checkedIds: readonly string[];
  onCheckedIdsChange: (ids: readonly string[]) => void;
  projection: ProjectionState;
  onProjectionChange: (projection: ProjectionState) => void;
  group?: GroupState;
  groups?: readonly GroupDefinition<R>[];
  onGroupChange?: (group: GroupState) => void;
  view?: CollectionView;
  onViewChange?: (view: CollectionView) => void;
  state?: SurfaceState;
  capabilities?: RecordCapabilities;
  recordCapabilities?: (record: R) => RecordCapabilities;
  onEdit?: (id: string) => void;
  title?: string;
  parentId?: (record: R) => string | null;
  dateFieldKey?: string;
  startFieldKey?: string;
  endFieldKey?: string;
  boardFieldKey?: string;
  supportedViews?: readonly CollectionView[];
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  bulkActions?: ReactNode;
  operation?: OperationState;
}>;
export type RecordFormProps<R extends RecordIdentity> = Readonly<{
  record: R;
  draft: R;
  fields: readonly FieldDefinition<R>[];
  errors: FieldErrors;
  onDraftChange: (draft: R) => void;
  onCommit: (draft: R, context?: { base: R }) => void;
  onCancel: (reason?: 'explicit' | 'close' | 'navigate') => void;
  disabled?: boolean;
  stale?: boolean;
  nonFieldErrors?: readonly string[];
  dirty?: boolean;
  readOnly?: boolean;
  capability?: Capability;
  operation?: OperationState;
  organization?: 'page' | 'sections' | 'steps' | 'tabs' | 'accordion';
  title?: string;
  children?: ReactNode;
}>;
export type RecordDisplayProps<R extends RecordIdentity> = Readonly<{
  record: R | null;
  fields: readonly FieldDefinition<R>[];
  recordId?: string | null;
  state?: SurfaceState;
  onEdit?: (id: string) => void;
  onClose?: () => void;
  capability?: Capability;
  presentation?: 'page' | 'sections' | 'tabs' | 'accordion';
  showHeading?: boolean;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  navigation?: {
    position: number;
    total: number;
    scopeLabel: string;
    onPrevious?: () => void;
    onNext?: () => void;
  };
  onOpenRelation?: (intent: {
    recordId: string;
    fieldKey: string;
    entityId: string;
    label: string;
  }) => void;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
  returnContext?: Readonly<{ label: string; onReturn: () => void }>;
  title?: string;
  children?: ReactNode;
}>;
