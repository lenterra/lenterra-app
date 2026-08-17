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

/**
 * Merge strings that arrived with the catalog.
 *
 * Mission titles, briefs, hints and failure diagnostics are *content*, not app
 * strings: they ship with the catalog so a new mission can reach a student
 * without an app release. They still have to reach i18next,
 * because `t(mission.titleKey)` is how a screen renders one — without this
 * every mission on the games tab shows the literal key `mission.congklak.m01.title`.
 *
 * Merged rather than replacing the bundle, so a catalog that omits a key falls
 * back to the built-in strings instead of blanking the UI.
 */
export function applyCatalogStrings(locale: Locale, strings: Record<string, unknown>): void {
  // A catalog can finish downloading before the translator is up — the sync
  // engine runs on its own triggers. Missing strings render as keys, which is
  // recoverable; throwing here would take down the sync that fetched them.
  if (!i18next.isInitialized) {
    initI18n();
  }
  i18next.addResourceBundle(locale, 'translation', strings, true, true);
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
