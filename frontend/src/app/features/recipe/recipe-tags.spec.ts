import { describe, it, expect } from 'vitest';
import { en } from '../../shared/i18n/en';
import { da } from '../../shared/i18n/da';
import {
  EMPTY_VOCABULARY,
  MAIN_COURSE_TAG,
  expandCuisine,
  hasTag,
  labelKeyFor,
  matchesCourse,
  splitTags,
  toOptions,
  toggleTag,
  type TagVocabulary,
} from './recipe-tags';

const vocabulary: TagVocabulary = {
  cuisines: [
    { value: 'italian' },
    { value: 'asian', children: ['thai', 'japanese'] },
    { value: 'thai' },
    { value: 'japanese' },
  ],
  proteins: [{ value: 'chicken' }],
  courses: [
    { value: 'main' },
    { value: 'dessert' },
    { value: 'soup' },
    { value: 'baking' },
    { value: 'drink' },
  ],
};

describe('labelKeyFor', () => {
  it('builds the documented key shape', () => {
    expect(labelKeyFor('cuisine', 'asian')).toBe('recipe.filters.cuisine.asian');
    expect(labelKeyFor('protein', 'chicken')).toBe('recipe.filters.protein.chicken');
    expect(labelKeyFor('course', 'dessert')).toBe('recipe.filters.course.dessert');
  });

  it('resolves in both dictionaries for every tag the backend serves today', () => {
    // The vocabulary is fetched at runtime, so `TranslationKey` can no longer
    // prove the key exists — `tools/check-tag-labels.mjs` is the build-time
    // guard. This is the same assertion for the values pinned in this spec.
    for (const value of ['asian', 'thai', 'japanese', 'italian']) {
      const key = labelKeyFor('cuisine', value);
      expect(en[key], `en is missing ${key}`).toBeTruthy();
      expect(da[key], `da is missing ${key}`).toBeTruthy();
    }
  });
});

describe('expandCuisine', () => {
  it('widens asian to what it stands over', () => {
    expect([...expandCuisine(vocabulary, 'asian')].sort()).toEqual(
      ['asian', 'japanese', 'thai'].sort(),
    );
  });

  it('does NOT widen a child back up to its siblings', () => {
    // Distractor: expanding through the parent in both directions makes
    // selecting Thai return every Japanese recipe.
    expect(expandCuisine(vocabulary, 'thai')).toEqual(['thai']);
  });

  it('passes an unknown or not-yet-loaded cuisine straight through', () => {
    expect(expandCuisine(vocabulary, 'georgian')).toEqual(['georgian']);
    expect(expandCuisine(EMPTY_VOCABULARY, 'asian')).toEqual(['asian']);
  });
});

describe('toOptions', () => {
  it('pairs each value with its label key, in the order the API served them', () => {
    expect(toOptions(vocabulary.cuisines, 'cuisine')).toEqual([
      { value: 'italian', labelKey: 'recipe.filters.cuisine.italian' },
      { value: 'asian', labelKey: 'recipe.filters.cuisine.asian' },
      { value: 'thai', labelKey: 'recipe.filters.cuisine.thai' },
      { value: 'japanese', labelKey: 'recipe.filters.cuisine.japanese' },
    ]);
  });

  it('is empty before the vocabulary arrives', () => {
    expect(toOptions(EMPTY_VOCABULARY.cuisines, 'cuisine')).toEqual([]);
  });

  it('offers Main, so the form can state what the filter matches on', () => {
    // While Main lived only in the filter, an author could not mark a dish as
    // one — the defect #84 fixes. It is now served like any other course.
    expect(toOptions(vocabulary.courses, 'course').map((o) => o.value)).toContain(
      MAIN_COURSE_TAG,
    );
  });
});

describe('matchesCourse', () => {
  it('matches a plain course by its tag', () => {
    expect(matchesCourse(vocabulary, ['dessert', 'quick'], 'Dessert')).toBe(true);
    expect(matchesCourse(vocabulary, ['dessert'], 'Soup')).toBe(false);
  });

  it('ignores capitalisation on both sides', () => {
    expect(matchesCourse(vocabulary, ['DESSERT'], 'dessert')).toBe(true);
  });

  it('matches Main when the recipe says so', () => {
    expect(matchesCourse(vocabulary, ['main', 'beef'], 'Main')).toBe(true);
  });

  it('still matches Main when no course is tagged at all', () => {
    // Every recipe written before the main tag existed carries no course. If
    // the tag were the only way in, turning it on would empty the facet.
    expect(matchesCourse(vocabulary, ['italian', 'dinner'], 'Main')).toBe(true);
    expect(matchesCourse(vocabulary, [], 'Main')).toBe(true);
  });

  it('does not call a dessert a main dish', () => {
    expect(matchesCourse(vocabulary, ['dessert'], 'Main')).toBe(false);
    expect(matchesCourse(vocabulary, ['baking', 'bread'], 'Main')).toBe(false);
  });

  it('does not call a cocktail a main dish', () => {
    expect(matchesCourse(vocabulary, ['drink', 'cocktail'], 'Main')).toBe(false);
    expect(matchesCourse(vocabulary, ['drink', 'cocktail'], 'Drink')).toBe(true);
  });

  it('takes an explicit main tag over the exclusion rule', () => {
    // A trifle that is somebody's main course is theirs to declare.
    expect(matchesCourse(vocabulary, ['main', 'dessert'], 'Main')).toBe(true);
  });

  it('excludes only the courses the backend actually serves', () => {
    // The exclusion list is derived, not restated: a course added to the
    // vocabulary must stop counting as a main dish without any other edit.
    const withStarter: TagVocabulary = {
      ...vocabulary,
      courses: [...vocabulary.courses, { value: 'starter' }],
    };
    expect(matchesCourse(vocabulary, ['starter'], 'Main')).toBe(true);
    expect(matchesCourse(withStarter, ['starter'], 'Main')).toBe(false);
  });
});

describe('toggleTag', () => {
  it('adds a tag lowercased and leaves the free-text ones alone', () => {
    expect(toggleTag(['slow-cooked'], 'Main')).toEqual(['slow-cooked', 'main']);
  });

  it('removes a tag whatever its capitalisation', () => {
    expect(toggleTag(['Main', 'tacos'], 'main')).toEqual(['tacos']);
  });
});

describe('splitTags and hasTag', () => {
  it('reads the comma-separated field as a list', () => {
    expect(splitTags(' main , tacos ,, ')).toEqual(['main', 'tacos']);
  });

  it('finds a tag case-insensitively', () => {
    expect(hasTag(['Main'], 'main')).toBe(true);
    expect(hasTag(['mains'], 'main')).toBe(false);
  });
});
