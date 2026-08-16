/**
 * Localisation (ADR-010, TRD-APP-006).
 *
 * **Indonesian is the source locale, not a translation of English.** The demo
 * shipped a mostly-English UI to an audience of rural Indonesian students,
 * which is a comprehension barrier before it is a polish issue. Strings are
 * authored in `id.json`; `en.json` may lag.
 *
 * `getFixedT` is exported so non-React code — the outbox's correction
 * messages, mission failure diagnostics — can translate without a hook.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import id from './id.json';
import en from './en.json';

export const SUPPORTED_LOCALES = ['id', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'id';

export function initI18n(locale: Locale = DEFAULT_LOCALE): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: locale,
      // Falls back to Indonesian, not English: an untranslated key should show
      // the language the audience reads.
      fallbackLng: DEFAULT_LOCALE,
      resources: { id: { translation: id }, en: { translation: en } },
      interpolation: { escapeValue: false },
      returnNull: false,
      // In development a missing key should be loud. In production it should
      // degrade to the key rather than crash a screen.
      saveMissing: false,
      missingKeyHandler:
        process.env.NODE_ENV === 'development'
          ? (_lngs, _ns, key) => {
              console.warn(`[i18n] missing key: ${key}`);
            }
          : undefined,
    });
  }
  return i18next;
}

export function setLocale(locale: Locale): void {
  void i18next.changeLanguage(locale);
}

export function currentLocale(): Locale {
  const language = i18next.language;
  return (SUPPORTED_LOCALES as readonly string[]).includes(language) ? (language as Locale) : DEFAULT_LOCALE;
}

/** Translate outside React. */
export function t(key: string, params?: Record<string, unknown>): string {
  return i18next.t(key, params) as string;
}

export { i18next };
