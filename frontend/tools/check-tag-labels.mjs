#!/usr/bin/env node
/**
 * Refuse a backend tag with no display label.
 *
 * The recipe tag vocabulary is owned by `backend/src/recipe/recipe-tags.ts` and
 * fetched at runtime, so the frontend derives each label key by convention:
 * `recipe.filters.<facet>.<value>`. That convention is a plain string, which
 * means TypeScript can no longer prove the key exists — the guarantee
 * `TranslationKey` used to give when the list was a local literal.
 *
 * A tag with no entry renders the bare key. It typechecks, it builds, the i18n
 * sweep passes (the template holds no literal), and every unit test is green:
 * the recipe list just shows "recipe.filters.cuisine.asian" as a chip. A missing
 * DANISH entry is worse still, because the English side looks perfect.
 *
 * So the compiler's job moves here: read the vocabulary the backend serves and
 * assert both dictionaries can name every word in it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const VOCABULARY = join(here, '../../backend/src/recipe/recipe-tags.ts');
const DICTIONARIES = {
  en: join(here, '../src/app/shared/i18n/en.ts'),
  da: join(here, '../src/app/shared/i18n/da.ts'),
};

/** Facet constant in the backend module → the key segment it maps to. */
const FACETS = {
  CUISINE_TAGS: 'cuisine',
  PROTEIN_TAGS: 'protein',
  COURSE_TAGS: 'course',
};

/** `export const NAME = 'value';` pairs, so `{ value: NAME }` can be resolved. */
function constantsIn(source) {
  return new Map(
    [...source.matchAll(/export const (\w+)\s*=\s*'([^']+)';/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
}

/**
 * The values in one exported facet array.
 *
 * A regex rather than a TypeScript parse: the file is a flat list of object
 * literals by design, and a parser would be a dependency for one shape. But a
 * regex that only reads quoted literals silently skips `{ value: SOME_CONST }`
 * — which is how `main` went unchecked here — so every entry must resolve, and
 * one that does not is an error rather than a quiet omission.
 */
function valuesOf(source, constant, constants) {
  const block = new RegExp(
    `export const ${constant}[^=]*=\\s*\\[(.*?)\\n\\];`,
    's',
  ).exec(source);
  if (!block) {
    console.error(`Could not find ${constant} in ${VOCABULARY}.`);
    console.error('If it was renamed, update FACETS in this script.');
    process.exit(1);
  }

  const entries = [...block[1].matchAll(/value:\s*([^,\n}]+)/g)].map((m) =>
    m[1].trim(),
  );
  return entries.map((entry) => {
    const quoted = /^'([^']+)'$/.exec(entry);
    if (quoted) return quoted[1];
    if (constants.has(entry)) return constants.get(entry);
    console.error(`Cannot read the value of an entry in ${constant}: ${entry}`);
    console.error(
      'This script reads quoted literals and `export const NAME = \'…\'`\n' +
        'references. Anything else would be skipped silently, leaving a tag\n' +
        'unchecked — so it fails here instead.',
    );
    process.exit(1);
  });
}

/** Keys a dictionary actually defines, with a non-empty value. */
function keysIn(file) {
  const source = readFileSync(file, 'utf8');
  return new Set(
    [...source.matchAll(/^\s*'([\w.]+)':\s*'([^']*)'/gm)]
      .filter(([, , value]) => value.trim().length > 0)
      .map(([, key]) => key),
  );
}

const vocabulary = readFileSync(VOCABULARY, 'utf8');
const constants = constantsIn(vocabulary);

const expected = [];
for (const [constant, facet] of Object.entries(FACETS)) {
  for (const value of valuesOf(vocabulary, constant, constants)) {
    expected.push(`recipe.filters.${facet}.${value}`);
  }
}

const findings = [];
for (const [language, file] of Object.entries(DICTIONARIES)) {
  const keys = keysIn(file);
  for (const key of expected) {
    if (!keys.has(key)) findings.push({ language, key });
  }
}

if (findings.length > 0) {
  console.error('Tags the backend serves that no dictionary can name:\n');
  for (const { language, key } of findings) {
    console.error(`  ${language}.ts is missing  ${key}`);
  }
  console.error(
    '\nAdd the key to both en.ts and da.ts. Left as-is, the filter chip renders\n' +
      'the raw key — no error, no failing test, just a wrong-looking word.',
  );
  process.exit(1);
}

console.log(
  `CLEAN — all ${expected.length} backend tags have a label in every language.`,
);
