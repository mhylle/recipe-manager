import type { TranslationKey } from '../../shared/i18n';

/**
 * The recipe tag vocabulary, as the backend serves it.
 *
 * `backend/src/recipe/recipe-tags.ts` is the source of truth — the same list
 * drives the image-prompt builder there — and the frontend fetches it from
 * `GET /recipe-tags` (see `RecipeTagService`). It used to be copied here, and
 * in the image service, and again as a bare course array in the list component;
 * the three drifted.
 */
export interface TagFacet {
  readonly value: string;
  /** Cuisines this one stands over — asian stands over thai and japanese. */
  readonly children?: readonly string[];
}

export interface TagVocabulary {
  readonly cuisines: readonly TagFacet[];
  readonly proteins: readonly TagFacet[];
  readonly courses: readonly TagFacet[];
}

/** What the filters render before the fetch lands, or if it fails. */
export const EMPTY_VOCABULARY: TagVocabulary = {
  cuisines: [],
  proteins: [],
  courses: [],
};

/** A tag ready to render: the stored value, plus the key for its display label. */
export interface TagOption {
  readonly value: string;
  readonly labelKey: TranslationKey;
}

export type TagKind = 'cuisine' | 'protein' | 'course';

/** The tag that says a dish is a main course. */
export const MAIN_COURSE_TAG = 'main';

/**
 * The dictionary key for a tag's display name.
 *
 * Labels stay in the frontend dictionaries rather than coming from the API:
 * they are chrome, and the `t` pipe switches language without a round trip,
 * whereas server-supplied text goes stale until something re-fetches it.
 *
 * The cast is the cost of a runtime vocabulary — `TranslationKey` can no longer
 * prove the key exists. `tools/check-tag-labels.mjs` reads the backend list and
 * fails `npm run check` when either dictionary is missing an entry, which is the
 * same guarantee moved from the compiler to the build.
 */
export function labelKeyFor(kind: TagKind, value: string): TranslationKey {
  return `recipe.filters.${kind}.${value.toLowerCase()}` as TranslationKey;
}

/** Pair each served value with its label key, keeping the API's order. */
export function toOptions(
  facets: readonly TagFacet[],
  kind: TagKind,
): readonly TagOption[] {
  return facets.map((facet) => ({
    value: facet.value,
    labelKey: labelKeyFor(kind, facet.value),
  }));
}

/**
 * A selected cuisine, plus anything it stands over.
 *
 * One-way on purpose: asking for Asian reaches Thai, asking for Thai does not
 * reach Japanese. An unknown value — or any value before the vocabulary has
 * arrived — passes through, so the filter narrows rather than returning nothing.
 */
export function expandCuisine(
  vocabulary: TagVocabulary,
  value: string,
): string[] {
  const wanted = value.toLowerCase();
  const facet = vocabulary.cuisines.find((tag) => tag.value === wanted);
  return [wanted, ...(facet?.children ?? [])];
}

/**
 * True when a recipe with these tags belongs to `course`.
 *
 * Main answers to two things: the tag itself, and — for every recipe written
 * before that tag existed — carrying no course tag at all. Without the second
 * clause, turning Main into a tag would empty the Main facet of the entire
 * existing library. The courses it excludes come from the served vocabulary
 * rather than a restated list, so adding a course cannot leave a stale copy
 * behind that counts the new one as a main dish.
 */
export function matchesCourse(
  vocabulary: TagVocabulary,
  tags: readonly string[],
  course: string,
): boolean {
  if (course.toLowerCase() !== MAIN_COURSE_TAG) {
    return hasTag(tags, course);
  }
  const otherCourses = vocabulary.courses.filter(
    (facet) => facet.value !== MAIN_COURSE_TAG,
  );
  return (
    hasTag(tags, MAIN_COURSE_TAG) ||
    !otherCourses.some((facet) => hasTag(tags, facet.value))
  );
}

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
