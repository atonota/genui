export * from './field-kit';
import {
  cloneRecord,
  recordsEqual,
  validateRecord,
  validateDateRange,
  protectedDraftFields,
  authorizedRecordDraft,
} from './field-kit';
import { initialRecords, type WorkspaceRecord } from './workspace';
import type {
  CollectionView,
  FieldDefinition,
  FieldErrors,
  FieldScalar,
  QueryState,
  RecordIdentity,
} from '../react/workspace/kit/contracts';

export type EquipmentRecord = {
  id: string;
  title: string;
  serial: string | null;
  category: 'computer' | 'instrument' | 'furniture';
  status: 'available' | 'in-use' | 'maintenance';
  location: string;
  custodianId: string | null;
  purchaseCost: number | null;
  currency: 'USD' | 'EUR';
  weightKg: number | null;
  inspected: string | null;
  calibrationStart: string | null;
  calibrationEnd: string | null;
  lastServicedInstant: string | null;
  serviceMinutes: number | null;
  needsService: boolean;
  notes: string;
  readOnly: boolean;
  restrictedSerial: boolean;
};
export type RecordSchema<R extends RecordIdentity> = Readonly<{
  id: string;
  label: string;
  fields: readonly FieldDefinition<R>[];
  initialRecords: () => R[];
  createRecord: (id: string) => R;
}>;
export const EMPTY_KIT_QUERY: QueryState = Object.freeze({ search: '', filters: [], sort: [] });
const textOperators = ['contains', 'eq', 'neq', 'is-empty', 'is-not-empty'] as const;
const numericOperators = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'is-empty',
  'is-not-empty',
] as const;
const choiceOperators = ['eq', 'neq', 'is-empty', 'is-not-empty'] as const;
const text = (value: FieldScalar) => (value === null ? '' : String(value));
const numeric = (value: FieldScalar) => (typeof value === 'number' ? value : null);
const nonnegative = (value: FieldScalar) =>
  value === null || (typeof value === 'number' && value >= 0)
    ? null
    : 'Enter zero or a positive number.';

export const ORDER_FIELDS: readonly FieldDefinition<WorkspaceRecord>[] = [
  {
    key: 'id',
    label: 'Order ID',
    kind: 'text',
    getValue: r => r.id,
    section: 'Identity',
    filterOperators: textOperators,
  },
  {
    key: 'title',
    label: 'Title',
    kind: 'text',
    getValue: r => r.title,
    setValue: (r, v) => ({ ...r, title: text(v) }),
    required: true,
    section: 'Identity',
    filterOperators: textOperators,
  },
  {
    key: 'customer',
    label: 'Customer',
    kind: 'text',
    getValue: r => r.customer,
    setValue: (r, v) => ({ ...r, customer: text(v) }),
    required: true,
    section: 'Identity',
    filterOperators: textOperators,
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'choice',
    getValue: r => r.status,
    setValue: (r, v) => ({
      ...r,
      status: v === 'approved' || v === 'shipped' || v === 'pending' ? v : 'draft',
    }),
    section: 'Planning',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'pending', label: 'Pending approval' },
      { value: 'approved', label: 'Approved' },
      { value: 'shipped', label: 'Shipped' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'owner',
    label: 'Owner',
    kind: 'entity',
    getValue: r => r.owner,
    setValue: (r, v) => ({ ...r, owner: text(v) }),
    section: 'Planning',
    options: [
      { value: 'Alex Reed', label: 'Alex Reed', description: 'Design team' },
      { value: 'Sam Lee', label: 'Sam Lee', description: 'Engineering team' },
      { value: 'Jordan Vale', label: 'Jordan Vale', description: 'Operations team' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'amount',
    label: 'Amount',
    kind: 'money',
    getValue: r => r.amount,
    setValue: (r, v) => ({ ...r, amount: numeric(v) }),
    precision: 2,
    currency: r => r.currency,
    section: 'Planning',
    validate: nonnegative,
    filterOperators: numericOperators,
  },
  {
    key: 'currency',
    label: 'Currency',
    kind: 'choice',
    getValue: r => r.currency,
    setValue: (r, v) => ({ ...r, currency: v === 'EUR' ? 'EUR' : 'USD' }),
    section: 'Planning',
    options: [
      { value: 'USD', label: 'USD' },
      { value: 'EUR', label: 'EUR' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'start',
    label: 'Start date',
    kind: 'date',
    getValue: r => r.start,
    setValue: (r, v) => ({ ...r, start: v === null || v === '' ? null : text(v) }),
    timezone: 'date-only',
    section: 'Planning',
    filterOperators: numericOperators,
  },
  {
    key: 'due',
    label: 'Due date',
    kind: 'date',
    getValue: r => r.due,
    setValue: (r, v) => ({ ...r, due: v === null || v === '' ? null : text(v) }),
    timezone: 'date-only',
    section: 'Planning',
    filterOperators: numericOperators,
    validate: (v, r) => validateDateRange(r.start, typeof v === 'string' ? v : null),
  },
  {
    key: 'notes',
    label: 'Notes',
    kind: 'multiline',
    getValue: r => r.notes,
    setValue: (r, v) => ({ ...r, notes: text(v) }),
    section: 'Context',
    filterOperators: textOperators,
  },
];
export const EQUIPMENT_FIELDS: readonly FieldDefinition<EquipmentRecord>[] = [
  {
    key: 'id',
    label: 'Asset ID',
    kind: 'text',
    getValue: r => r.id,
    section: 'Identity',
    filterOperators: textOperators,
  },
  {
    key: 'title',
    label: 'Equipment name',
    kind: 'text',
    getValue: r => r.title,
    setValue: (r, v) => ({ ...r, title: text(v) }),
    required: true,
    section: 'Identity',
    filterOperators: textOperators,
  },
  {
    key: 'serial',
    label: 'Serial number',
    kind: 'text',
    getValue: r => r.serial,
    setValue: (r, v) => ({ ...r, serial: v === null || v === '' ? null : text(v) }),
    section: 'Identity',
    availability: r =>
      r.restrictedSerial
        ? { state: 'restricted', reason: 'Serial number is restricted in this supplied example.' }
        : { state: 'available' },
    editable: r =>
      r.category === 'instrument'
        ? {
            allowed: false,
            reason:
              'Instrument serial numbers are readable but not editable in this supplied example.',
          }
        : { allowed: true },
    filterOperators: textOperators,
  },
  {
    key: 'category',
    label: 'Category',
    kind: 'choice',
    getValue: r => r.category,
    setValue: (r, v) => ({
      ...r,
      category: v === 'instrument' || v === 'furniture' ? v : 'computer',
    }),
    section: 'Identity',
    options: [
      { value: 'computer', label: 'Computer' },
      { value: 'instrument', label: 'Instrument' },
      { value: 'furniture', label: 'Furniture' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'status',
    label: 'Availability',
    kind: 'choice',
    getValue: r => r.status,
    setValue: (r, v) => ({ ...r, status: v === 'in-use' || v === 'maintenance' ? v : 'available' }),
    section: 'Condition',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'in-use', label: 'In use' },
      { value: 'maintenance', label: 'Maintenance' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'location',
    label: 'Location',
    kind: 'text',
    getValue: r => r.location,
    setValue: (r, v) => ({ ...r, location: text(v) }),
    required: true,
    section: 'Condition',
    filterOperators: textOperators,
  },
  {
    key: 'custodianId',
    label: 'Custodian',
    kind: 'entity',
    getValue: r => r.custodianId,
    setValue: (r, v) => ({ ...r, custodianId: v === null || v === '' ? null : text(v) }),
    section: 'Condition',
    options: [
      { value: 'person-01', label: 'Alex Reed', description: 'Design — person-01' },
      { value: 'person-02', label: 'Alex Reed', description: 'Operations — person-02' },
      { value: 'person-03', label: 'Sam Lee', description: 'Engineering — person-03' },
    ],
    filterOperators: choiceOperators,
  },
  {
    key: 'weightKg',
    label: 'Weight',
    kind: 'unit',
    getValue: r => r.weightKg,
    setValue: (r, v) => ({ ...r, weightKg: numeric(v) }),
    precision: 3,
    unit: 'kg',
    section: 'Condition',
    validate: nonnegative,
    availability: r =>
      r.category === 'furniture'
        ? {
            state: 'not-applicable',
            reason: 'Weight is not collected for furniture in this schema.',
          }
        : { state: 'available' },
    filterOperators: numericOperators,
  },
  {
    key: 'purchaseCost',
    label: 'Purchase cost',
    kind: 'money',
    getValue: r => r.purchaseCost,
    setValue: (r, v) => ({ ...r, purchaseCost: numeric(v) }),
    precision: 2,
    currency: r => r.currency,
    section: 'Condition',
    validate: nonnegative,
    availability: r =>
      r.id === 'AS-004'
        ? { state: 'unavailable', reason: 'Purchase cost is unavailable in the supplied snapshot.' }
        : { state: 'available' },
    filterOperators: numericOperators,
  },
  {
    key: 'inspected',
    label: 'Inspection date',
    kind: 'date',
    getValue: r => r.inspected,
    setValue: (r, v) => ({ ...r, inspected: v === null || v === '' ? null : text(v) }),
    timezone: 'date-only',
    section: 'Condition',
    filterOperators: numericOperators,
  },
  {
    key: 'calibrationStart',
    label: 'Calibration start',
    kind: 'date',
    getValue: r => r.calibrationStart,
    setValue: (r, v) => ({ ...r, calibrationStart: v === null || v === '' ? null : text(v) }),
    timezone: 'date-only',
    section: 'Condition',
    filterOperators: numericOperators,
  },
  {
    key: 'calibrationEnd',
    label: 'Calibration end',
    kind: 'date',
    getValue: r => r.calibrationEnd,
    setValue: (r, v) => ({ ...r, calibrationEnd: v === null || v === '' ? null : text(v) }),
    timezone: 'date-only',
    section: 'Condition',
    filterOperators: numericOperators,
    validate: (v, r) => validateDateRange(r.calibrationStart, typeof v === 'string' ? v : null),
  },
  {
    key: 'lastServicedInstant',
    label: 'Last serviced at',
    kind: 'datetime',
    getValue: r => r.lastServicedInstant,
    setValue: (r, v) => ({ ...r, lastServicedInstant: v === null || v === '' ? null : text(v) }),
    timezone: 'UTC',
    section: 'Condition',
    help: 'Enter an ISO 8601 instant with Z or an explicit offset. Display uses UTC.',
    availability: r =>
      r.id === 'AS-004'
        ? { state: 'unknown', reason: 'No service timestamp was supplied for this record.' }
        : { state: 'available' },
    filterOperators: numericOperators,
  },
  {
    key: 'serviceMinutes',
    label: 'Service duration',
    kind: 'duration',
    getValue: r => r.serviceMinutes,
    setValue: (r, v) => ({ ...r, serviceMinutes: numeric(v) }),
    precision: 0,
    unit: 'min',
    section: 'Condition',
    validate: nonnegative,
    filterOperators: numericOperators,
  },
  {
    key: 'needsService',
    label: 'Needs service',
    kind: 'boolean',
    getValue: r => r.needsService,
    setValue: (r, v) => ({ ...r, needsService: v === true }),
    section: 'Condition',
    filterOperators: choiceOperators,
  },
  {
    key: 'notes',
    label: 'Notes',
    kind: 'multiline',
    getValue: r => r.notes,
    setValue: (r, v) => ({ ...r, notes: text(v) }),
    section: 'Context',
    filterOperators: textOperators,
  },
];

export function newOrderRecord(id: string): WorkspaceRecord {
  return {
    id,
    title: '',
    customer: '',
    status: 'draft',
    payment: 'unpaid',
    delivery: 'planned',
    owner: '',
    city: '',
    amount: null,
    currency: 'USD',
    start: null,
    due: null,
    priority: 'normal',
    notes: '',
    readOnly: false,
    lines: [],
  };
}
export function newEquipmentRecord(id: string): EquipmentRecord {
  return {
    id,
    title: '',
    serial: null,
    category: 'computer',
    status: 'available',
    location: '',
    custodianId: null,
    purchaseCost: null,
    currency: 'USD',
    weightKg: null,
    inspected: null,
    calibrationStart: null,
    calibrationEnd: null,
    lastServicedInstant: null,
    serviceMinutes: null,
    needsService: false,
    notes: '',
    readOnly: false,
    restrictedSerial: false,
  };
}
export function initialEquipmentRecords(): EquipmentRecord[] {
  return [
    {
      ...newEquipmentRecord('AS-001'),
      title: 'Precision measurement instrument — Laboratory calibration station',
      serial: 'CAL-2001',
      category: 'instrument',
      location: 'Lab A',
      custodianId: 'person-01',
      purchaseCost: 1240.5,
      weightKg: 2.125,
      inspected: '2026-10-02',
      calibrationStart: '2026-10-14',
      calibrationEnd: '2026-10-16',
      lastServicedInstant: '2026-10-02T09:30:00+03:00',
      serviceMinutes: 90,
    },
    {
      ...newEquipmentRecord('AS-002'),
      title: 'Research laptop',
      serial: 'COMP-2002',
      location: 'Studio',
      purchaseCost: 0,
      weightKg: 1.3,
      inspected: '2026-10-10',
      status: 'in-use',
      restrictedSerial: true,
    },
    {
      ...newEquipmentRecord('AS-003'),
      title: 'Workshop desk',
      category: 'furniture',
      location: 'Workshop',
      purchaseCost: null,
      notes: 'Fictional equipment record. No inventory service is connected.',
    },
    {
      ...newEquipmentRecord('AS-004'),
      title: 'Testing instrument',
      serial: 'CAL-2004',
      category: 'instrument',
      location: 'Lab B',
      status: 'maintenance',
      needsService: true,
      readOnly: true,
    },
  ];
}
export const ORDER_SCHEMA: RecordSchema<WorkspaceRecord> = {
  id: 'orders',
  label: 'Orders',
  fields: ORDER_FIELDS,
  initialRecords,
  createRecord: newOrderRecord,
};
export const EQUIPMENT_SCHEMA: RecordSchema<EquipmentRecord> = {
  id: 'equipment',
  label: 'Equipment',
  fields: EQUIPMENT_FIELDS,
  initialRecords: initialEquipmentRecords,
  createRecord: newEquipmentRecord,
};

export type KitDatasetState<R extends RecordIdentity> = {
  records: R[];
  activeId: string | null;
  checkedIds: readonly string[];
  preparedIds: readonly string[];
  draft: R | null;
  original: R | null;
  baseExisted?: boolean;
  errors: FieldErrors;
  query: QueryState;
  projection: readonly string[];
  view: CollectionView;
  message: string;
};
export function initialKitState<R extends RecordIdentity>(
  schema: RecordSchema<R>,
): KitDatasetState<R> {
  const records = schema.initialRecords();
  return {
    records,
    activeId: records[0]?.id ?? null,
    checkedIds: [],
    preparedIds: [],
    draft: null,
    original: null,
    errors: {},
    query: { search: '', filters: [], sort: [] },
    projection: schema.fields.slice(0, 5).map(field => field.key),
    view: 'table',
    message: 'Local committed dataset; no server is connected.',
  };
}
export function beginKitDraft<R extends RecordIdentity>(
  state: KitDatasetState<R>,
  schema: RecordSchema<R>,
  id?: string,
): KitDatasetState<R> {
  if (state.draft)
    return { ...state, message: 'Finish or discard the current draft before starting another.' };
  const original = id ? state.records.find(record => record.id === id) : undefined;
  if (id && !original) return { ...state, message: 'Record not found.' };
  if (original && 'readOnly' in original && original.readOnly === true)
    return { ...state, message: 'This supplied record is read-only.' };
  let sequence = state.records.length + 1;
  while (state.records.some(record => record.id === `${schema.id}-new-${sequence}`)) sequence++;
  const draft = cloneRecord(original ?? schema.createRecord(`${schema.id}-new-${sequence}`));
  return {
    ...state,
    draft,
    original: cloneRecord(original ?? draft),
    baseExisted: Boolean(original),
    errors: {},
    message: original
      ? 'Editing a local draft. Committed values stay unchanged until commit.'
      : 'Creating a local draft. It is not listed until commit.',
  };
}
export function isKitDraftStale<R extends RecordIdentity>(state: KitDatasetState<R>): boolean {
  if (!state.original || !state.draft) return false;
  const current = state.records.find(record => record.id === state.original!.id);
  return current ? !recordsEqual(current, state.original) : state.baseExisted === true;
}

export function commitKitDraft<R extends RecordIdentity>(
  state: KitDatasetState<R>,
  fields: readonly FieldDefinition<R>[],
): KitDatasetState<R> {
  if (!state.draft) return state;
  if (state.original && state.original.id !== state.draft.id)
    return { ...state, message: 'The draft record identity cannot change.' };
  if (state.original && 'readOnly' in state.original && state.original.readOnly === true)
    return { ...state, message: 'This supplied record is read-only.' };
  if (isKitDraftStale(state))
    return {
      ...state,
      message:
        'The record changed since this draft began. Review the latest values before committing.',
    };
  const original = state.original ?? state.draft;
  const errors = validateRecord(state.draft, protectedDraftFields(original, fields));
  if (Object.keys(errors).length)
    return { ...state, errors, message: 'Review the invalid fields before committing.' };
  const committed = cloneRecord(authorizedRecordDraft(original, state.draft, fields));
  const exists = state.records.some(record => record.id === committed.id);
  return {
    ...state,
    records: exists
      ? state.records.map(record => (record.id === committed.id ? committed : record))
      : [...state.records, committed],
    activeId: committed.id,
    draft: null,
    original: null,
    errors: {},
    message: 'Committed locally. The list and record display share these values.',
  };
}
export function discardKitDraft<R extends RecordIdentity>(
  state: KitDatasetState<R>,
): KitDatasetState<R> {
  return {
    ...state,
    draft: null,
    original: null,
    errors: {},
    message: 'Draft discarded. Committed values are unchanged.',
  };
}
