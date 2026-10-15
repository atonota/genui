/** Shared Intl primitives; callers retain their own empty/invalid/capability policy. */
export const intlLocale = (locale: string): string =>
  locale === 'tr' || locale === 'tr-TR' ? 'tr-TR' : 'en-US';
export const formatNumericValue = (
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string => new Intl.NumberFormat(intlLocale(locale), options).format(value);
export const formatDateValue = (
  value: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string => new Intl.DateTimeFormat(intlLocale(locale), options).format(value);
export const scalarCollator = (locale: string): Intl.Collator =>
  new Intl.Collator(intlLocale(locale), { numeric: true, sensitivity: 'base' });
