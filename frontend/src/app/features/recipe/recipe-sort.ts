import { Recipe } from '../../shared/models/recipe.model';
import { Difficulty } from '../../shared/enums/difficulty.enum';
import { bcp47Of, type Locale, type TranslationKey } from '../../shared/i18n';

export type RecipeSort =
  | 'name-asc'
  | 'name-desc'
  | 'time-asc'
  | 'time-desc'
  | 'difficulty-asc';

export interface RecipeSortOption {
  readonly value: RecipeSort;
  readonly labelKey: TranslationKey;
}

export const RECIPE_SORT_OPTIONS: readonly RecipeSortOption[] = [
  { value: 'name-asc', labelKey: 'recipe.sort.nameAsc' },
  { value: 'name-desc', labelKey: 'recipe.sort.nameDesc' },
  { value: 'time-asc', labelKey: 'recipe.sort.timeAsc' },
  { value: 'time-desc', labelKey: 'recipe.sort.timeDesc' },
  { value: 'difficulty-asc', labelKey: 'recipe.sort.difficultyAsc' },
];

export const DEFAULT_RECIPE_SORT: RecipeSort = 'name-asc';

export function isRecipeSort(value: unknown): value is RecipeSort {
  return RECIPE_SORT_OPTIONS.some((o) => o.value === value);
}

/** Culinary order. Sorting the enum alphabetically gives easy < hard < medium. */
const DIFFICULTY_RANK: Record<Difficulty, number> = {
  [Difficulty.EASY]: 0,
  [Difficulty.MEDIUM]: 1,
  [Difficulty.HARD]: 2,
};

const totalTime = (r: Recipe): number => r.prepTime + r.cookTime;

/**
 * Order recipes for display.
 *
 * Name comparison goes through `Intl.Collator` for the ACTIVE language, not a
 * plain `<`. Danish sorts æ, ø and å after z, whereas English treats them as
 * variants of a and o — so the same library genuinely comes out in a different
 * order depending on who is reading, and a single hard-coded collation is wrong
 * for one of them. Numeric collation also keeps "Recipe 2" before "Recipe 10".
 *
 * Returns a new array; the input is left alone.
 */
export function sortRecipes(
  recipes: readonly Recipe[],
  sort: RecipeSort,
  locale: Locale,
): Recipe[] {
  const collator = new Intl.Collator(bcp47Of(locale), { numeric: true, sensitivity: 'base' });
  const byName = (a: Recipe, b: Recipe): number => collator.compare(a.name, b.name);

  const comparators: Record<RecipeSort, (a: Recipe, b: Recipe) => number> = {
    'name-asc': byName,
    'name-desc': (a, b) => byName(b, a),
    'time-asc': (a, b) => totalTime(a) - totalTime(b),
    'time-desc': (a, b) => totalTime(b) - totalTime(a),
    'difficulty-asc': (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty],
  };

  const compare = comparators[sort];
  // Name is the tie-breaker everywhere, so equal times or difficulties never
  // come back in whatever arbitrary order the API happened to return.
  return [...recipes].sort((a, b) => compare(a, b) || byName(a, b));
}
