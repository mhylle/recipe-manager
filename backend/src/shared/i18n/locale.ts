/**
 * Server-side locale resolution.
 *
 * The frontend sends the active UI language as `Accept-Language` (see the
 * localeInterceptor). This module turns that header into one of the locales we
 * actually store content in, and defines the fallback rule used on every read.
 */

export const SUPPORTED_LOCALES = ['en', 'da'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Parse an `Accept-Language` header down to a supported locale.
 *
 * Handles the full grammar the browser actually sends — a q-weighted list such as
 * `da-DK,da;q=0.9,en;q=0.8` — by taking the highest-weighted entry we support,
 * matching on the primary subtag so 'da-DK' and 'da' both resolve to Danish.
 * Anything unrecognised (or a missing header) falls back to the default rather
 * than throwing, because a bad header must never fail an API request.
 */
export function resolveLocale(
  acceptLanguage: string | undefined | null,
): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const candidates = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((c) => c.tag.length > 0)
    // Stable sort by descending weight so equal weights keep header order.
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) {
      return primary;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Pick the best available translation: the requested locale, else the row's
 * source locale, else whatever exists. Returning `undefined` is reserved for a
 * row that has no translations at all, which the schema should make impossible.
 */
export function pickTranslation<T extends { locale: string }>(
  translations: readonly T[],
  requested: Locale,
  sourceLocale: string,
): T | undefined {
  return (
    translations.find((t) => t.locale === requested) ??
    translations.find((t) => t.locale === sourceLocale) ??
    translations[0]
  );
}
