import { describe, it, expect } from 'vitest';
import { RECIPE_SORT_OPTIONS, DEFAULT_RECIPE_SORT, sortRecipes } from './recipe-sort';
import { Recipe } from '../../shared/models/recipe.model';
import { Difficulty } from '../../shared/enums/difficulty.enum';

function recipe(name: string, extra: Partial<Recipe> = {}): Recipe {
  return {
    id: name,
    name,
    description: '',
    servings: 2,
    instructions: [],
    ingredients: [],
    prepTime: 10,
    cookTime: 10,
    difficulty: Difficulty.EASY,
    tags: [],
    ...extra,
  };
}

const names = (rs: readonly Recipe[]): string[] => rs.map((r) => r.name);

describe('sortRecipes', () => {
  it('sorts by name A-Z by default', () => {
    const input = [recipe('Tiramisù'), recipe('Boeuf Bourguignon'), recipe('Guacamole')];
    expect(names(sortRecipes(input, DEFAULT_RECIPE_SORT, 'en'))).toEqual([
      'Boeuf Bourguignon',
      'Guacamole',
      'Tiramisù',
    ]);
  });

  it('defaults to name ascending', () => {
    expect(DEFAULT_RECIPE_SORT).toBe('name-asc');
  });

  it('uses DANISH collation when the locale is Danish', () => {
    // Danish sorts æ, ø and å AFTER z. A naive `a.name < b.name` comparison, or
    // localeCompare with the wrong locale, puts Æbleskiver in the wrong place.
    const input = [recipe('Ærteskud'), recipe('Boeuf'), recipe('Ølsuppe'), recipe('Zabaione')];
    expect(names(sortRecipes(input, 'name-asc', 'da'))).toEqual([
      'Boeuf',
      'Zabaione',
      'Ærteskud',
      'Ølsuppe',
    ]);
  });

  it('uses ENGLISH collation when the locale is English', () => {
    // In English, Æ collates near A and Ø near O — so the very same list comes
    // out in a different order. This is the distractor: one hard-coded collation
    // cannot satisfy both languages.
    const input = [recipe('Ærteskud'), recipe('Boeuf'), recipe('Ølsuppe'), recipe('Zabaione')];
    expect(names(sortRecipes(input, 'name-asc', 'en'))).toEqual([
      'Ærteskud',
      'Boeuf',
      'Ølsuppe',
      'Zabaione',
    ]);
  });

  it('sorts by name Z-A', () => {
    const input = [recipe('Boeuf'), recipe('Tiramisù'), recipe('Guacamole')];
    expect(names(sortRecipes(input, 'name-desc', 'en'))).toEqual([
      'Tiramisù',
      'Guacamole',
      'Boeuf',
    ]);
  });

  it('sorts by TOTAL time, not prep time alone', () => {
    // Distractor: sorting on prepTime alone reverses these two.
    const quick = recipe('Quick', { prepTime: 30, cookTime: 0 });
    const slow = recipe('Slow', { prepTime: 5, cookTime: 90 });
    expect(names(sortRecipes([slow, quick], 'time-asc', 'en'))).toEqual(['Quick', 'Slow']);
    expect(names(sortRecipes([quick, slow], 'time-desc', 'en'))).toEqual(['Slow', 'Quick']);
  });

  it('sorts by difficulty in culinary order, not alphabetically', () => {
    // Alphabetically it is easy < hard < medium, which is nonsense to a cook.
    const input = [
      recipe('H', { difficulty: Difficulty.HARD }),
      recipe('E', { difficulty: Difficulty.EASY }),
      recipe('M', { difficulty: Difficulty.MEDIUM }),
    ];
    expect(names(sortRecipes(input, 'difficulty-asc', 'en'))).toEqual(['E', 'M', 'H']);
  });

  it('breaks ties by name so the order is never arbitrary', () => {
    const input = [
      recipe('Zabaione', { prepTime: 5, cookTime: 5 }),
      recipe('Aioli', { prepTime: 5, cookTime: 5 }),
    ];
    expect(names(sortRecipes(input, 'time-asc', 'en'))).toEqual(['Aioli', 'Zabaione']);
  });

  it('does not mutate the input array', () => {
    const input = [recipe('Zabaione'), recipe('Aioli')];
    const before = names(input);
    sortRecipes(input, 'name-asc', 'en');
    expect(names(input)).toEqual(before);
  });

  describe('by rating', () => {
    const rated = (name: string, ratingAverage: number | null, likeCount = 0) =>
      recipe(name, {
        reactions: {
          likeCount,
          ratingCount: ratingAverage === null ? 0 : 1,
          ratingAverage,
          likedByMe: false,
          myStars: null,
        },
      });

    it('puts the highest average first', () => {
      const input = [rated('Middling', 3), rated('Great', 5), rated('Poor', 1)];
      expect(names(sortRecipes(input, 'rating-desc', 'en'))).toEqual([
        'Great',
        'Middling',
        'Poor',
      ]);
    });

    it('sinks the unrated below even a one-star recipe', () => {
      // The distractor: treating a null average as 0 would still put it last
      // here, but treating it as "no opinion" must not float it to the top.
      const input = [rated('Unrated', null), rated('Poor', 1)];
      expect(names(sortRecipes(input, 'rating-desc', 'en'))).toEqual([
        'Poor',
        'Unrated',
      ]);
    });

    it('handles a recipe from before reactions existed', () => {
      const input = [recipe('Legacy'), rated('Great', 5)];
      expect(names(sortRecipes(input, 'rating-desc', 'en'))).toEqual([
        'Great',
        'Legacy',
      ]);
    });

    it('orders by likes when asked for likes, not by score', () => {
      const input = [rated('Adored', 1, 9), rated('Excellent', 5, 0)];
      expect(names(sortRecipes(input, 'likes-desc', 'en'))).toEqual([
        'Adored',
        'Excellent',
      ]);
    });

    it('breaks a rating tie by name', () => {
      const input = [rated('Zabaione', 4), rated('Aioli', 4)];
      expect(names(sortRecipes(input, 'rating-desc', 'en'))).toEqual([
        'Aioli',
        'Zabaione',
      ]);
    });
  });

  it('exposes every option with a translation key', () => {
    expect(RECIPE_SORT_OPTIONS.length).toBeGreaterThan(1);
    for (const option of RECIPE_SORT_OPTIONS) {
      expect(option.labelKey.startsWith('recipe.sort.')).toBe(true);
    }
    expect(RECIPE_SORT_OPTIONS.some((o) => o.value === DEFAULT_RECIPE_SORT)).toBe(true);
  });
});
