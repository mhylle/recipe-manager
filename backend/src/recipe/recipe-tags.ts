/**
 * The canonical recipe tag vocabulary.
 *
 * One source of truth for every consumer: the image-prompt builder reads the
 * cuisine slice, and the frontend fetches the whole thing from
 * `GET /recipe-tags` rather than keeping its own copy. Until this
 * module existed the list lived in three places — the filter component, the
 * authoring form's shared list, and the image service — and they drifted.
 *
 * Values are the words stored on a recipe, so they are canonical, lowercase and
 * English. Display names are NOT here: they are UI chrome and live in the
 * frontend dictionaries, keyed `recipe.filters.<facet>.<value>`, so switching
 * language does not need a round trip. `frontend/tools/check-tag-labels.mjs`
 * fails the build if a value here has no label in either language.
 */

export interface TagFacet {
  readonly value: string;
  /**
   * Cuisines this one stands over. Selecting the parent matches a recipe
   * tagged with any child; selecting a child never widens back to the parent.
   */
  readonly children?: readonly string[];
}

export const CUISINE_TAGS: readonly TagFacet[] = [
  { value: 'mexican' },
  { value: 'italian' },
  { value: 'asian', children: ['thai', 'japanese'] },
  { value: 'thai' },
  { value: 'japanese' },
  { value: 'danish' },
  { value: 'french' },
];

export const PROTEIN_TAGS: readonly TagFacet[] = [
  { value: 'chicken' },
  { value: 'pork' },
  { value: 'beef' },
  { value: 'fish' },
  { value: 'vegetarian' },
];

/** The tag that says a dish is a main course. */
export const MAIN_COURSE_TAG = 'main';

/** The tag that says a recipe is something to drink — a cocktail, a smoothie. */
export const DRINK_TAG = 'drink';

/**
 * The courses an author can put on a recipe.
 *
 * Main is one of them (#84): while it lived only in the filter, an author could
 * not SAY a dish was a main course. The exclusion rule — a recipe tagged none of
 * the others is a main dish — survives in the frontend's `matchesCourse` as the
 * fallback for every recipe written before the tag existed.
 */
export const COURSE_TAGS: readonly TagFacet[] = [
  { value: MAIN_COURSE_TAG },
  { value: 'dessert' },
  { value: 'appetizer' },
  { value: 'soup' },
  { value: 'snack' },
  { value: 'baking' },
  // Without this a cocktail carries no course tag and the Main fallback would
  // count it as a main dish.
  { value: DRINK_TAG },
];

/** The whole vocabulary, in the shape the API serves it. */
export const TAG_VOCABULARY = {
  cuisines: CUISINE_TAGS,
  proteins: PROTEIN_TAGS,
  courses: COURSE_TAGS,
} as const;

export type TagVocabulary = typeof TAG_VOCABULARY;

/**
 * A selected cuisine, plus anything it stands over.
 *
 * One-way on purpose: Asian reaches Thai, Thai does not reach Asian's other
 * children. An unknown value passes through so a hand-typed tag still filters.
 */
export function expandCuisine(value: string): string[] {
  const wanted = value.toLowerCase();
  const facet = CUISINE_TAGS.find((tag) => tag.value === wanted);
  return [wanted, ...(facet?.children ?? [])];
}

/** Cuisines that stand over another, most specific first. */
const CUISINES_BY_SPECIFICITY: readonly TagFacet[] = [...CUISINE_TAGS].sort(
  (a, b) => (a.children?.length ?? 0) - (b.children?.length ?? 0),
);

/**
 * The cuisine a recipe's tags name, or '' when none does.
 *
 * Most specific wins: a recipe tagged both `asian` and `thai` describes itself
 * better as Thai, and that pairing is the normal case once asian is an umbrella.
 */
export function cuisineOf(tags: readonly string[]): string {
  const lowered = tags.map((tag) => tag.toLowerCase());
  return (
    CUISINES_BY_SPECIFICITY.find((facet) => lowered.includes(facet.value))
      ?.value ?? ''
  );
}

/** True when the tags say this recipe is a drink. Exact match, never a substring. */
export function isDrink(tags: readonly string[]): boolean {
  return tags.some((tag) => tag.toLowerCase() === DRINK_TAG);
}
