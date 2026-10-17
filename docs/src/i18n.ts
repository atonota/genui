import { readMigratedItem } from './storage-migration';

export type Locale = 'en' | 'tr';
export type MessageParams = Readonly<Record<string, string | number>>;
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'genux-locale';
const LOCALE_EVENT = 'genux-locale-change';
let turkishMessages: Readonly<Record<string, string>> | undefined;
let turkishPromise: Promise<Readonly<Record<string, string>>> | undefined;
let requestVersion = 0;

export function getLocaleSnapshot(): Locale {
  return typeof document !== 'undefined' && document.documentElement.lang === 'tr' ? 'tr' : 'en';
}

export function getServerLocaleSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(LOCALE_EVENT, listener);
  return () => window.removeEventListener(LOCALE_EVENT, listener);
}

export function translate(
  message: string,
  params: MessageParams = {},
  locale: Locale = getLocaleSnapshot(),
): string {
  const template =
    locale === 'tr' && turkishMessages && Object.hasOwn(turkishMessages, message)
      ? turkishMessages[message]!
      : message;
  return template.replace(/\{([\w]+)\}/g, (match, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : match,
  );
}

export function applyLocaleToDocument(): void {
  if (typeof document === 'undefined') return;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const message = element.dataset.i18n;
    if (message) element.textContent = translate(message);
  }
  for (const attribute of ['aria-label', 'placeholder', 'title', 'alt', 'content']) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`)) {
      const message = element.getAttribute(`data-i18n-${attribute}`);
      if (message) element.setAttribute(attribute, translate(message));
    }
  }
}

export async function setLocale(locale: Locale): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const target = document;
  const version = ++requestVersion;
  if (locale === 'tr' && !turkishMessages) {
    turkishPromise ??= import('./locales/tr/index').then(module => module.default);
    try {
      turkishMessages = await turkishPromise;
    } catch (error) {
      turkishPromise = undefined;
      throw error;
    }
  }
  if (version !== requestVersion || typeof document === 'undefined' || document !== target) return;
  document.documentElement.lang = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Language changes still work when preference storage is unavailable.
  }
  applyLocaleToDocument();
  window.dispatchEvent(new Event(LOCALE_EVENT));
}

export async function restoreLocale(): Promise<void> {
  if (typeof window === 'undefined') return;
  let locale: Locale = DEFAULT_LOCALE;
  try {
    if (readMigratedItem(window.localStorage, LOCALE_STORAGE_KEY) === 'tr') locale = 'tr';
  } catch {
    // English remains the default when preference storage is unavailable.
  }
  await setLocale(locale);
}

/** Tolerant search for translated text and stable English component identifiers. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .trim();
}

export function formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocaleSnapshot(), options).format(value);
}

export function formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(getLocaleSnapshot(), options).format(value);
}
