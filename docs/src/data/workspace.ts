import { normalizeSearch, type Locale } from '../i18n';
import { formatNumericValue, formatDateValue, scalarCollator } from './value-format';

export const EXPERIMENT_DATE = '2026-10-13';
export type RecordStatus = 'draft' | 'pending' | 'approved' | 'shipped';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type DeliveryStatus = 'planned' | 'preparing' | 'delivered';
export type Currency = 'USD' | 'EUR';
export type OrderLine = { id: string; product: string; quantity: number; unitPrice: number };
export type WorkspaceRecord = {
  id: string;
  title: string;
  customer: string;
  status: RecordStatus;
  payment: PaymentStatus;
  delivery: DeliveryStatus;
  owner: string;
  city: string;
  amount: number | null;
  currency: Currency;
  start: string | null;
  due: string | null;
  priority: 'normal' | 'high';
  notes: string;
  readOnly: boolean;
  parentId?: string;
  lines: OrderLine[];
};
export const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending approval',
  approved: 'Approved',
  shipped: 'Shipped',
} as const;
export const PAYMENT_LABELS = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid' } as const;
export const DELIVERY_LABELS = {
  planned: 'Planned',
  preparing: 'Preparing',
  delivered: 'Delivered',
} as const;
export const WORKSPACE_FIELDS = [
  { key: 'id', label: 'Order ID', kind: 'text' },
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'customer', label: 'Customer', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'enum' },
  { key: 'payment', label: 'Payment', kind: 'enum' },
  { key: 'delivery', label: 'Delivery', kind: 'enum' },
  { key: 'owner', label: 'Owner', kind: 'text' },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'amount', label: 'Amount', kind: 'money' },
  { key: 'due', label: 'Due date', kind: 'date' },
  { key: 'notes', label: 'Notes', kind: 'text' },
] as const;

export function initialRecords(): WorkspaceRecord[] {
  const customers = [
    'Aster Workshop — Research and Sustainable Packaging Division',
    'Birch Studio',
    'Cedar Office',
    'Dune Collective',
    'Elm Works',
    'Fern House',
    'Grove Design',
    'Harbor Makers',
    'Iris Engineering',
    'Juniper Laboratory',
    'Kite Operations',
    'Linden Supply',
  ];
  const amounts = [1240, 0, 2350, 490, 1780, 325, null, 1525, 960, 3400, 1125, 640];
  const statuses: RecordStatus[] = [
    'pending',
    'approved',
    'shipped',
    'pending',
    'approved',
    'shipped',
    'draft',
    'approved',
    'pending',
    'pending',
    'shipped',
    'draft',
  ];
  return customers.map((customer, index) => ({
    id: `SP-26-${String(401 + index).padStart(4, '0')}`,
    title: ['Prototype material order', 'Packaging samples', 'Office equipment'][index % 3]!,
    customer,
    status: statuses[index]!,
    payment: (['unpaid', 'paid', 'partial'] as const)[index % 3]!,
    delivery: (['planned', 'preparing', 'delivered'] as const)[index % 3]!,
    owner: ['Alex Reed', 'Sam Lee', 'Jordan Vale'][index % 3]!,
    city: ['Istanbul', 'London', 'Berlin'][index % 3]!,
    amount: amounts[index]!,
    currency: index >= 9 ? 'EUR' : 'USD',
    start: index === 6 ? null : `2026-10-${String(2 + index).padStart(2, '0')}`,
    due: index === 6 ? null : `2026-10-${String(8 + index * 2).padStart(2, '0')}`,
    priority: index % 4 === 0 ? 'high' : 'normal',
    notes:
      index === 0
        ? 'Fictional operational note: keep the complete delivery together. Review the customer reference, confirm packaging requirements and retain this long note when changing views, groups or presentation containers.'
        : 'Fictional example record. No customer data or live service is connected.',
    readOnly: index === 2,
    ...(index === 1 || index === 2 ? { parentId: 'SP-26-0401' } : {}),
    lines: [{ id: `line-${index}-1`, product: 'Sample kit', quantity: index + 1, unitPrice: 25 }],
  }));
}

export type WorkspaceFilter = {
  query?: string;
  status?: RecordStatus | 'all';
  owner?: string;
  city?: string;
  payment?: PaymentStatus | 'all';
  minAmount?: number;
  maxAmount?: number;
  dueBefore?: string;
  overdueOnly?: boolean;
};
const normalized = normalizeSearch;
export function filterRecords(
  records: readonly WorkspaceRecord[],
  filter: WorkspaceFilter,
): WorkspaceRecord[] {
  const query = normalized(filter.query ?? '');
  return records.filter(
    record =>
      (!query ||
        normalized(
          `${record.id} ${record.title} ${record.customer} ${record.owner} ${record.city}`,
        ).includes(query)) &&
      (!filter.status || filter.status === 'all' || record.status === filter.status) &&
      (!filter.owner || filter.owner === 'all' || record.owner === filter.owner) &&
      (!filter.city || filter.city === 'all' || record.city === filter.city) &&
      (!filter.payment || filter.payment === 'all' || record.payment === filter.payment) &&
      (filter.minAmount === undefined ||
        (record.amount !== null && record.amount >= filter.minAmount)) &&
      (filter.maxAmount === undefined ||
        (record.amount !== null && record.amount <= filter.maxAmount)) &&
      (!filter.dueBefore || (record.due !== null && record.due <= filter.dueBefore)) &&
      (!filter.overdueOnly ||
        (record.due !== null && record.due < EXPERIMENT_DATE && record.status !== 'shipped')),
  );
}
export type SortCriterion = {
  field: 'id' | 'customer' | 'amount' | 'due' | 'status' | 'owner';
  direction: 'asc' | 'desc';
};
export function sortRecords(
  records: readonly WorkspaceRecord[],
  criteria: readonly SortCriterion[],
  locale: Locale = 'en',
): WorkspaceRecord[] {
  const collator = scalarCollator(locale);
  return [...records].sort((a, b) => {
    for (const { field, direction } of criteria) {
      const x = a[field],
        y = b[field];
      if (x === null || y === null) {
        if (x !== y) return x === null ? 1 : -1;
        continue;
      }
      const compared =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : collator.compare(String(x), String(y));
      if (compared) return direction === 'asc' ? compared : -compared;
    }
    return collator.compare(a.id, b.id);
  });
}
export function groupRecords(
  records: readonly WorkspaceRecord[],
  key: 'status' | 'owner' | 'city' | 'payment',
) {
  const groups = new Map<string, WorkspaceRecord[]>();
  for (const record of records) {
    const value = record[key];
    groups.set(value, [...(groups.get(value) ?? []), record]);
  }
  return [...groups].map(([key, records]) => ({ key, records }));
}
export function currencyTotals(
  records: readonly WorkspaceRecord[],
): { currency: Currency; amount: number | null }[] {
  const totals = new Map<Currency, number | null>();
  for (const record of records) {
    if (record.amount === null) continue;
    const previous = totals.get(record.currency) ?? 0;
    const cents = Math.round(record.amount * 100);
    const sum = previous + cents;
    // Keep unsupported values explicit; never format overflow as a valid total.
    if (
      totals.get(record.currency) === null ||
      !Number.isSafeInteger(cents) ||
      !Number.isSafeInteger(sum)
    )
      totals.set(record.currency, null);
    else totals.set(record.currency, sum);
  }
  return [...totals].map(([currency, cents]) => ({
    currency,
    amount: cents === null ? null : cents / 100,
  }));
}
export type BulkChange = {
  field: 'owner' | 'city' | 'notes';
  mode: 'unchanged' | 'clear' | 'set';
  value: string;
};
export function bulkUpdate(
  records: readonly WorkspaceRecord[],
  ids: readonly string[],
  change: BulkChange,
) {
  const targets = new Set(ids),
    appliedIds: string[] = [],
    excludedIds: string[] = [];
  const next = records.map(record => {
    if (!targets.has(record.id)) return record;
    if (record.readOnly) {
      excludedIds.push(record.id);
      return record;
    }
    if (change.mode === 'unchanged' || (change.mode === 'set' && !change.value.trim()))
      return record;
    appliedIds.push(record.id);
    return { ...record, [change.field]: change.mode === 'clear' ? '' : change.value.trim() };
  });
  return { records: next, appliedIds, excludedIds };
}
export function moneyText(amount: number | null, currency: Currency, locale: Locale): string {
  return amount === null
    ? '—'
    : formatNumericValue(amount, locale, { style: 'currency', currency, currencyDisplay: 'code' });
}
export function dateText(value: string | null, locale: Locale): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—';
  return formatDateValue(date, locale, { dateStyle: 'medium', timeZone: 'UTC' });
}
