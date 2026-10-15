import { useSyncExternalStore } from 'react';
import {
  getLocaleSnapshot,
  getServerLocaleSnapshot,
  subscribeLocale,
  translate,
  type MessageParams,
} from '../i18n';

export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getServerLocaleSnapshot);
  return {
    locale,
    t: (message: string, params?: MessageParams) => translate(message, params, locale),
  };
}
