import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocaleService } from './locale.service';
import { LOCALE_STORAGE_KEY, resolveInitialLocale } from './locale';

/** Pin navigator.language before the service is constructed — it reads it once, at init. */
function withBrowserLanguage(language: string): void {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);
}

function createService(): LocaleService {
  TestBed.configureTestingModule({});
  return TestBed.inject(LocaleService);
}

describe('resolveInitialLocale', () => {
  it('prefers an explicitly stored choice over the browser language', () => {
    expect(resolveInitialLocale('da', 'en-US')).toBe('da');
    expect(resolveInitialLocale('en', 'da-DK')).toBe('en');
  });

  it('falls back to the browser language when nothing is stored', () => {
    expect(resolveInitialLocale(null, 'da-DK')).toBe('da');
    expect(resolveInitialLocale(null, 'en-GB')).toBe('en');
  });

  it('matches on the primary subtag so regional variants resolve', () => {
    expect(resolveInitialLocale(null, 'da')).toBe('da');
    expect(resolveInitialLocale(null, 'DA-dk')).toBe('da');
  });

  it('falls back to English for a language we do not support', () => {
    // Distractor: 'fr' must NOT resolve to Danish just because it is not English.
    expect(resolveInitialLocale(null, 'fr-FR')).toBe('en');
    expect(resolveInitialLocale(null, '')).toBe('en');
  });

  it('ignores a corrupt stored value instead of throwing', () => {
    expect(resolveInitialLocale('klingon', 'da-DK')).toBe('da');
    expect(resolveInitialLocale('', 'en-US')).toBe('en');
    expect(resolveInitialLocale('{}', 'fr-FR')).toBe('en');
  });
});

describe('LocaleService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts in the browser language when no choice is stored', () => {
    withBrowserLanguage('da-DK');
    expect(createService().locale()).toBe('da');
  });

  it('starts in the stored language even when the browser disagrees', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'da');
    withBrowserLanguage('en-US');
    expect(createService().locale()).toBe('da');
  });

  it('persists an explicit choice so it survives a reload', () => {
    withBrowserLanguage('en-US');
    createService().setLocale('da');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('da');

    // Simulate a reload: fresh injector, same storage, same browser language.
    TestBed.resetTestingModule();
    expect(createService().locale()).toBe('da');
  });

  it('does NOT persist a merely-detected language', () => {
    // Only an explicit setLocale() is a user decision. Writing the detected value
    // would freeze the first visit's browser language forever.
    withBrowserLanguage('da-DK');
    createService();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('tracks the active locale on the document element', () => {
    withBrowserLanguage('en-US');
    const service = createService();
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');

    service.setLocale('da');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('da');
  });

  it('translates through the active locale and follows a switch', () => {
    withBrowserLanguage('en-US');
    const service = createService();
    expect(service.translate('language.switcher.label')).toBe('Language');

    service.setLocale('da');
    expect(service.translate('language.switcher.label')).toBe('Sprog');
  });

  it('interpolates named parameters', () => {
    withBrowserLanguage('en-US');
    const service = createService();
    expect(service.translate('common.actions.deleteNamed', { name: 'Guacamole' })).toBe(
      'Delete Guacamole',
    );

    service.setLocale('da');
    expect(service.translate('common.actions.deleteNamed', { name: 'Guacamole' })).toBe(
      'Slet Guacamole',
    );
  });

  it('renders the key itself for an unknown key rather than an empty string', () => {
    withBrowserLanguage('en-US');
    const service = createService();
    // Cast: the whole point is behaviour when a key escapes the type system.
    expect(service.translate('nope.not.a.key' as never)).toBe('nope.not.a.key');
  });

  it('survives localStorage being unavailable', () => {
    withBrowserLanguage('da-DK');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    const service = createService();
    expect(service.locale()).toBe('da');
    expect(() => service.setLocale('en')).not.toThrow();
    expect(service.locale()).toBe('en');
  });
});
