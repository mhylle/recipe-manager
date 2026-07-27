import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DICTIONARIES } from './dictionaries';
import type { TranslationKey } from './en';
import { LOCALE_STORAGE_KEY, Locale, resolveInitialLocale } from './locale';

export type TranslateParams = Record<string, string | number>;

/** localStorage throws in some privacy modes; a missing preference is not an error. */
function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Preference simply won't survive the session. Not worth failing the app over.
  }
}

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<Locale>(
    resolveInitialLocale(readStoredLocale(), navigator.language),
  );

  /** The active language. Reading this in a template makes that view locale-reactive. */
  readonly locale = this.current.asReadonly();

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.current();
    });
  }

  /**
   * Record an explicit user choice. Only this persists — a merely *detected*
   * language is never written, so a first visit does not permanently pin the
   * browser's language against the user's later preference.
   */
  setLocale(locale: Locale): void {
    this.current.set(locale);
    writeStoredLocale(locale);
  }

  /**
   * Look up `key` in the active language.
   *
   * Reads the `current` signal, so callers inside a reactive context (a template,
   * a computed) re-evaluate automatically when the language changes.
   */
  translate(key: TranslationKey, params?: TranslateParams): string {
    const template = DICTIONARIES[this.current()][key];
    if (template === undefined) {
      // Only reachable when a key escapes the type system. Show the key rather
      // than a blank so the gap is obvious on screen instead of invisible.
      return key;
    }
    return params ? interpolate(template, params) : template;
  }
}

function interpolate(template: string, params: TranslateParams): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
