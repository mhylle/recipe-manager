import { describe, it, expect } from 'vitest';
import { en } from './en';
import { da } from './da';

const DICTIONARIES = { en, da } as const;

/** `{{name}}` — the only placeholder form interpolate() understands. */
const PLACEHOLDER = /\{\{(\w+)\}\}/g;
/** `{name}` — looks right, silently renders literally. */
const SINGLE_BRACE = /(?<!\{)\{(\w+)\}(?!\})/;

const placeholdersIn = (value: string): string[] =>
  [...value.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

describe('translation dictionaries', () => {
  describe.each(Object.entries(DICTIONARIES))('%s', (_name, dictionary) => {
    const entries = Object.entries(dictionary) as [string, string][];

    it('has entries (so the checks below are not vacuous)', () => {
      expect(entries.length).toBeGreaterThan(200);
    });

    it('uses {{double}} braces for every placeholder, never {single}', () => {
      // A single-brace placeholder is not an error anywhere — it just renders
      // as literal text, so it survives typechecking, the i18n gate and every
      // unit test, and is only visible by looking at the running page.
      const wrong = entries
        .filter(([, value]) => SINGLE_BRACE.test(value))
        .map(([key, value]) => `${key}: ${value}`);
      expect(wrong).toEqual([]);
    });

    it('never leaves an unclosed placeholder', () => {
      const wrong = entries
        .filter(([, value]) => {
          const opens = (value.match(/\{\{/g) ?? []).length;
          const closes = (value.match(/\}\}/g) ?? []).length;
          return opens !== closes;
        })
        .map(([key]) => key);
      expect(wrong).toEqual([]);
    });
  });

  it('gives every key the SAME placeholders in both languages', () => {
    // A translator dropping {{name}} produces a sentence with a hole in it.
    const mismatched = Object.keys(en)
      .map((key) => {
        const typedKey = key as keyof typeof en;
        const inEn = placeholdersIn(en[typedKey]);
        const inDa = placeholdersIn(da[typedKey]);
        return { key, inEn, inDa };
      })
      .filter(({ inEn, inDa }) => inEn.join(',') !== inDa.join(','))
      .map(({ key, inEn, inDa }) => `${key}: en[${inEn}] vs da[${inDa}]`);
    expect(mismatched).toEqual([]);
  });

  it('has no empty values', () => {
    const empty = Object.entries(en)
      .concat(Object.entries(da))
      .filter(([, value]) => (value as string).trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
