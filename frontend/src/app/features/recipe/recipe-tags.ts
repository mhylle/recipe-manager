import type { TranslationKey } from '../../shared/i18n';

/** A tag the filters know about, plus the key for its display label. */
export interface TagOption {
  readonly value: string;
  readonly labelKey: TranslationKey;
}

/**
 * The tags that drive the recipe filters.
 *
 * These words are load-bearing: the cuisine and protein facets match a recipe by
 * looking for its tag by NAME. Until this list existed in one place it lived
 * only inside the filter component, so the authoring form could not offer it —
 * a recipe landed in a facet only if its author happened to type the exact word.
 * The Birria was tagged "dinner, mexican" and never appeared under Beef.
 *
 * `value` is matched against the stored tags and MUST stay English; only
 * `labelKey` decides what a reader sees. Comparison is case-insensitive on both
 * sides (tags are stored lowercased), so the capitalisation here is cosmetic.
 */
export const CUISINE_TAGS: readonly TagOption[] = [
  { value: 'Mexican', labelKey: 'recipe.filters.cuisine.mexican' },
  { value: 'Italian', labelKey: 'recipe.filters.cuisine.italian' },
  { value: 'Thai', labelKey: 'recipe.filters.cuisine.thai' },
  { value: 'Japanese', labelKey: 'recipe.filters.cuisine.japanese' },
  { value: 'Danish', labelKey: 'recipe.filters.cuisine.danish' },
  { value: 'French', labelKey: 'recipe.filters.cuisine.french' },
];

export const PROTEIN_TAGS: readonly TagOption[] = [
  { value: 'Chicken', labelKey: 'recipe.filters.protein.chicken' },
  { value: 'Pork', labelKey: 'recipe.filters.protein.pork' },
  { value: 'Beef', labelKey: 'recipe.filters.protein.beef' },
  { value: 'Fish', labelKey: 'recipe.filters.protein.fish' },
  { value: 'Vegetarian', labelKey: 'recipe.filters.protein.vegetarian' },
];

/**
 * The courses that are actual tags.
 *
 * "Main" is deliberately absent: the filter defines a main dish by EXCLUSION —
 * anything not tagged as one of these — so a `main` tag would drive nothing and
 * offering it in the form would be a control that quietly does nothing. The
 * filter adds Main to its own list as an option; it is not part of the
 * vocabulary an author writes.
 */
export const COURSE_TAGS: readonly TagOption[] = [
  { value: 'Dessert', labelKey: 'recipe.filters.course.dessert' },
  { value: 'Appetizer', labelKey: 'recipe.filters.course.appetizer' },
  { value: 'Soup', labelKey: 'recipe.filters.course.soup' },
  { value: 'Snack', labelKey: 'recipe.filters.course.snack' },
  { value: 'Baking', labelKey: 'recipe.filters.course.baking' },
];

/** Every tag the filters understand, in the order the form offers them. */
export const FILTER_TAGS: readonly TagOption[] = [
  ...CUISINE_TAGS,
  ...PROTEIN_TAGS,
  ...COURSE_TAGS,
];

/** The comma-separated tags field, as a list. */
export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** True when this tag is already on the recipe, whatever its capitalisation. */
export function hasTag(tags: readonly string[], value: string): boolean {
  return tags.some((tag) => tag.toLowerCase() === value.toLowerCase());
}

/**
 * Add or remove one tag, leaving every other one exactly as the author typed it.
 *
 * Rebuilding the field from the known vocabulary would be simpler and would
 * silently delete "slow-cooked" and "tacos" — the free-text tags are the whole
 * reason the box stays.
 */
export function toggleTag(tags: readonly string[], value: string): string[] {
  return hasTag(tags, value)
    ? tags.filter((tag) => tag.toLowerCase() !== value.toLowerCase())
    : [...tags, value.toLowerCase()];
}
