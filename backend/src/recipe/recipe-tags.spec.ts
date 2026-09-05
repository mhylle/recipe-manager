import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CUISINE_TAGS,
  COURSE_TAGS,
  PROTEIN_TAGS,
  TAG_VOCABULARY,
  cuisineOf,
  expandCuisine,
} from './recipe-tags.js';

const values = (facet: readonly { value: string }[]): string[] =>
  facet.map((tag) => tag.value);

describe('the tag vocabulary', () => {
  it('offers asian as a cuisine', () => {
    expect(values(CUISINE_TAGS)).toContain('asian');
  });

  it('is canonical lowercase throughout — tags are stored lowercased', () => {
    const wrong = [...CUISINE_TAGS, ...PROTEIN_TAGS, ...COURSE_TAGS]
      .map((tag) => tag.value)
      .filter((value) => value !== value.toLowerCase());
    expect(wrong).toEqual([]);
  });

  it('names every child as a facet in its own right', () => {
    // A child that is not also offered on its own would be filterable only
    // through its parent — you could ask for Asian but never for just Thai.
    const offered = values(CUISINE_TAGS);
    const orphans = CUISINE_TAGS.flatMap((tag) => tag.children ?? []).filter(
      (child) => !offered.includes(child),
    );
    expect(orphans).toEqual([]);
  });

  it('serves all three facets under one vocabulary', () => {
    expect(Object.keys(TAG_VOCABULARY).sort()).toEqual([
      'courses',
      'cuisines',
      'proteins',
    ]);
  });
});

describe('expandCuisine', () => {
  it('widens asian to its children', () => {
    expect([...expandCuisine('asian')].sort()).toEqual(
      ['asian', 'japanese', 'thai'].sort(),
    );
  });

  it('does NOT widen a child back up to its siblings', () => {
    // Distractor: an implementation that expands through the parent both ways
    // makes Thai match every Japanese recipe.
    expect(expandCuisine('thai')).toEqual(['thai']);
  });

  it('leaves a cuisine with no children alone', () => {
    expect(expandCuisine('italian')).toEqual(['italian']);
  });

  it('is case-insensitive and passes an unknown value straight through', () => {
    expect([...expandCuisine('Asian')].sort()).toEqual(
      ['asian', 'japanese', 'thai'].sort(),
    );
    expect(expandCuisine('georgian')).toEqual(['georgian']);
  });
});

describe('cuisineOf', () => {
  it('finds the cuisine among a recipe’s tags', () => {
    expect(cuisineOf(['dinner', 'asian', 'chicken'])).toBe('asian');
  });

  it('prefers the most specific tag when a recipe carries both', () => {
    // "Thai cuisine" is a better image prompt than "Asian cuisine", and a
    // recipe tagged both is the normal case once asian is an umbrella.
    expect(cuisineOf(['asian', 'thai'])).toBe('thai');
    expect(cuisineOf(['thai', 'asian'])).toBe('thai');
  });

  it('matches case-insensitively, because tags are free text', () => {
    expect(cuisineOf(['Asian'])).toBe('asian');
  });

  it('is empty when no tag names a cuisine', () => {
    expect(cuisineOf(['weeknight', 'leftovers'])).toBe('');
  });
});

describe('nothing keeps a second copy of the vocabulary', () => {
  /** Every .ts file under src, recursively. */
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    });
  }

  it('has no other file listing cuisines inline', () => {
    // The exact bug this replaces: image-generation.service.ts carried its own
    // ['mexican', 'italian', ...] in TWO places, so a cuisine added to the
    // filters silently lost its image prompt. Nothing failed — the picture was
    // just blander. A grep is the only thing that catches a copy.
    const offenders = sourceFiles(join(__dirname, '..'))
      // Specs naming tags is the point of a spec; production code holding a
      // list is the duplication.
      .filter((file) => !file.endsWith('.spec.ts') && !file.endsWith('recipe-tags.ts'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        const named = CUISINE_TAGS.filter((tag) =>
          source.includes(`'${tag.value}'`) || source.includes(`"${tag.value}"`),
        );
        return named.length >= 2;
      })
      .map((file) => file.replace(join(__dirname, '..'), 'src'));
    expect(offenders).toEqual([]);
  });
});
