import { signal } from '@angular/core';
import type { Provider } from '@angular/core';
import { RecipeTagService } from './recipe-tag.service';
import type { TagVocabulary } from './recipe-tags';

/**
 * The vocabulary specs render against.
 *
 * Deliberately NOT imported from the backend — a spec that reads the real list
 * passes whatever that list happens to say, and stops testing the umbrella at
 * all the day someone edits it. `tools/check-tag-labels.mjs` is what keeps the
 * two in step; this fixture keeps the behaviour tests stable.
 */
export const TEST_VOCABULARY: TagVocabulary = {
  cuisines: [
    { value: 'mexican' },
    { value: 'italian' },
    { value: 'asian', children: ['thai', 'japanese'] },
    { value: 'thai' },
    { value: 'japanese' },
    { value: 'danish' },
    { value: 'french' },
  ],
  proteins: [
    { value: 'chicken' },
    { value: 'pork' },
    { value: 'beef' },
    { value: 'fish' },
    { value: 'vegetarian' },
  ],
  courses: [
    { value: 'main' },
    { value: 'dessert' },
    { value: 'appetizer' },
    { value: 'soup' },
    { value: 'snack' },
    { value: 'baking' },
  ],
};

/** Stand in for the fetch, so a spec never needs HttpClient for chips. */
export function provideTestVocabulary(
  vocabulary: TagVocabulary = TEST_VOCABULARY,
): Provider {
  return {
    provide: RecipeTagService,
    useValue: { vocabulary: signal(vocabulary).asReadonly() },
  };
}

/** Every value the fixture serves, across all three facets. */
export const TEST_TAG_VALUES: readonly string[] = [
  ...TEST_VOCABULARY.cuisines,
  ...TEST_VOCABULARY.proteins,
  ...TEST_VOCABULARY.courses,
].map((facet) => facet.value);
