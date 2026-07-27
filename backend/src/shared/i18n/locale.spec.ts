import { resolveLocale, pickTranslation, DEFAULT_LOCALE } from './locale.js';

describe('resolveLocale', () => {
  it('resolves a simple tag', () => {
    expect(resolveLocale('da')).toBe('da');
    expect(resolveLocale('en')).toBe('en');
  });

  it('matches on the primary subtag', () => {
    expect(resolveLocale('da-DK')).toBe('da');
    expect(resolveLocale('en-GB')).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(resolveLocale('DA-dk')).toBe('da');
  });

  it('honours q-weights rather than taking the first entry', () => {
    // Distractor: a naive "split(',')[0]" implementation returns 'fr' here.
    expect(resolveLocale('fr;q=0.2,da;q=0.9')).toBe('da');
    expect(resolveLocale('fr-FR,da-DK;q=0.9')).toBe('da');
  });

  it('takes the highest-weighted SUPPORTED language, skipping unsupported ones', () => {
    expect(resolveLocale('de-DE,da;q=0.8,en;q=0.5')).toBe('da');
  });

  it('falls back to the default for unsupported, missing or malformed headers', () => {
    expect(resolveLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(';;;')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('da;q=notanumber')).toBe('da');
  });
});

describe('pickTranslation', () => {
  const da = { locale: 'da', name: 'Kylling' };
  const en = { locale: 'en', name: 'Chicken' };

  it('returns the requested locale when present', () => {
    expect(pickTranslation([en, da], 'da', 'en')).toBe(da);
  });

  it('falls back to the source locale when the request has no translation', () => {
    expect(pickTranslation([en], 'da', 'en')).toBe(en);
  });

  it('falls back to whatever exists rather than returning nothing', () => {
    // A row whose sourceLocale translation was deleted must still render text.
    expect(pickTranslation([da], 'en', 'en')).toBe(da);
  });

  it('returns undefined only when there are no translations at all', () => {
    expect(pickTranslation([], 'en', 'en')).toBeUndefined();
  });
});
