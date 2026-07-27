/**
 * The registry of supported languages.
 *
 * Adding a language means adding an entry here and a matching dictionary file —
 * nothing else. Detection, the switcher UI and the storage round-trip all derive
 * from this list.
 */
export const LOCALES = [
  // `bcp47` is what Intl.* and the Accept-Language header need. Kept beside the
  // code so adding a language stays a one-line change here plus a dictionary.
  { code: 'en', label: 'English', bcp47: 'en-US' },
  { code: 'da', label: 'Dansk', bcp47: 'da-DK' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'recipe-manager.locale';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((entry) => entry.code === value);
}

/** The BCP-47 tag for a locale, e.g. 'da' -> 'da-DK'. */
export function bcp47Of(locale: Locale): string {
  return LOCALES.find((entry) => entry.code === locale)!.bcp47;
}

/**
 * Decide which language to start in.
 *
 * A stored choice is an explicit user decision and always wins. Otherwise fall
 * back to the browser's preferred language, matching on the primary subtag so
 * 'da-DK' and plain 'da' both resolve to Danish. Anything unrecognised — including
 * a corrupt or stale stored value — lands on the default rather than throwing.
 */
export function resolveInitialLocale(stored: string | null, browserLanguage: string): Locale {
  if (isLocale(stored)) {
    return stored;
  }
  const primarySubtag = browserLanguage.split('-')[0].toLowerCase();
  return isLocale(primarySubtag) ? primarySubtag : DEFAULT_LOCALE;
}
