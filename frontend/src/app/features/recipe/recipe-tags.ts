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

/** The tag that says a dish is a main course. */
export const MAIN_COURSE_TAG = 'Main';

/**
 * The courses an author can put on a recipe.
 *
 * Main used to be missing here: the filter defined a main dish by EXCLUSION —
 * anything tagged none of the others — so there was nothing for a `main` tag to
 * drive. That left an author unable to SAY a dish is a main course, which is
 * how it reads to everyone who is not the filter. Main is now a tag like the
 * rest; the exclusion rule survives inside `matchesCourse` as the fallback for
 * the recipes written before it existed.
 */
export const COURSE_TAGS: readonly TagOption[] = [
  { value: MAIN_COURSE_TAG, labelKey: 'recipe.filters.course.main' },
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

/**
 * True when a recipe with these tags belongs to `course`.
 *
 * Main answers to two things: the tag itself, and — for every recipe written
 * before that tag existed — carrying no course tag at all. Without the second
 * clause, turning Main into a tag would empty the Main facet of the entire
 * existing library. The list it excludes is derived from COURSE_TAGS rather
 * than restated, so adding a course cannot leave a stale copy behind that
 * counts the new one as a main dish.
 */
export function matchesCourse(tags: readonly string[], course: string): boolean {
  if (course.toLowerCase() !== MAIN_COURSE_TAG.toLowerCase()) {
    return hasTag(tags, course);
  }
  const otherCourses = COURSE_TAGS.filter((option) => option.value !== MAIN_COURSE_TAG);
  return hasTag(tags, MAIN_COURSE_TAG)
    || !otherCourses.some((option) => hasTag(tags, option.value));
}
