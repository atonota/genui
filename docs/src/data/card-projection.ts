import type { CardFact, CardMetric } from './card-model';

function number(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return 'Not available';
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return new Intl.NumberFormat('en').format(value);
  }
}

/** Presentation only: this helper never accesses a record or evaluates a field getter. */
export function formatCardFact(fact: CardFact, locale = 'en'): string {
  const value = fact.value;
  if (value === null) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (fact.format === 'date' && typeof value === 'string') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(date.valueOf()) || (dateOnly && date.toISOString().slice(0, 10) !== value))
      return value;
    return dateOnly
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
      : `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
  }
  if (typeof value !== 'number') return value;
  if (fact.format === 'currency' && fact.currency)
    return number(value, locale, { style: 'currency', currency: fact.currency });
  // Percent facts and relative deltas use the 0–100 scale, e.g. 18.4 means 18.4%.
  if (fact.format === 'percent')
    return number(value / 100, locale, { style: 'percent', maximumFractionDigits: 2 });
  return number(value, locale);
}

export function formatCardMetric(metric: CardMetric, locale = 'en'): string {
  if (metric.value === null) return 'Not available';
  const value = number(
    metric.value,
    locale,
    metric.currency ? { style: 'currency', currency: metric.currency } : undefined,
  );
  return metric.unit && !metric.currency && value !== 'Not available'
    ? `${value} ${metric.unit}`
    : value;
}

export function formatCardDelta(value: number, locale = 'en'): string {
  return number(value / 100, locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 2,
  });
}

export function formatCardBytes(bytes: number, locale = 'en'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Not available';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  const index = Math.min(3, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)));
  return `${number(bytes / 1024 ** index, locale, { maximumFractionDigits: 1 })} ${units[index]}`;
}
