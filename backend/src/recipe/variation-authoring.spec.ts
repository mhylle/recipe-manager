import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { UNRESTRICTED } from './recipe-visibility';
import { NotFoundException } from '@nestjs/common';

/**
 * What the authoring form needs, which is not what a reader gets.
 *
 * A reader is served one language and the variation already applied. Editing
 * needs the opposite: the differences themselves, in every language, each one
 * keyed by the id it points at. Reading a variation back through the reader's
 * payload would mean re-deriving which of eighteen steps was overridden by
 * comparing text — and comparing text is how all eighteen end up overridden.
 */
describe('RecipeRepository.findVariationsForAuthoring', () => {
  const row = {
    id: 'r1',
    sourceLocale: 'en',
    servings: 2,
    prepTime: 740,
    cookTime: 30,
    difficulty: 'easy',
    tags: [],
    imageUrl: null,
    thumbnailUrl: null,
    instructionImages: [],
    isPrivate: false,
    pantryId: null,
    createdById: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
    translations: [],
    ingredients: [
      {
        id: 'i-yeast',
        quantity: 1,
        unit: 'g',
        pantryCategory: 'baking',
        sortOrder: 0,
        translations: [
          { locale: 'en', name: 'Fresh Yeast' },
          { locale: 'da', name: 'Frisk gær' },
        ],
      },
    ],
    steps: [
      {
        id: 's0',
        sortOrder: 0,
        imageUrl: null,
        translations: [
          { locale: 'en', text: 'Stir the yeast in' },
          { locale: 'da', text: 'Rør gæren ud' },
        ],
      },
      {
        id: 's1',
        sortOrder: 1,
        imageUrl: null,
        translations: [{ locale: 'en', text: 'Add the flour' }],
      },
    ],
    variations: [
      {
        id: 'v1',
        sortOrder: 0,
        prepTime: 180,
        cookTime: null,
        translations: [
          { locale: 'en', name: '10 g yeast', note: 'The quickest.' },
          { locale: 'da', name: '10 g gær', note: 'Den hurtigste.' },
        ],
        ingredients: [
          {
            id: 'vi1',
            ingredientId: 'i-yeast',
            removed: false,
            quantity: 10,
            unit: null,
            pantryCategory: null,
            sortOrder: 0,
            translations: [],
          },
          {
            id: 'vi2',
            ingredientId: null,
            removed: false,
            quantity: 8,
            unit: 'g',
            pantryCategory: 'baking',
            sortOrder: 1,
            translations: [
              { locale: 'en', name: 'Sugar' },
              { locale: 'da', name: 'Sukker' },
            ],
          },
        ],
        steps: [
          {
            id: 'vs1',
            stepId: 's0',
            removed: false,
            afterPosition: null,
            translations: [
              { locale: 'en', text: 'Stir the sugar in too' },
              { locale: 'da', text: 'Rør også sukkeret i' },
            ],
          },
        ],
      },
    ],
  };

  const build = (found: unknown = row) =>
    new RecipeRepository({
      recipe: { findFirst: jest.fn().mockResolvedValue(found) },
    } as unknown as PrismaService);

  it('returns the base method keyed by id, in every language', async () => {
    // Keyed, not positional. The form has to render "this is step s0's shared
    // text" while the author is writing Danish, and an index would be one
    // reorder away from showing the wrong one.
    const authoring = await build().findVariationsForAuthoring(
      'r1',
      UNRESTRICTED,
    );

    expect(authoring.baseSteps).toEqual([
      {
        id: 's0',
        texts: [
          { locale: 'en', text: 'Stir the yeast in' },
          { locale: 'da', text: 'Rør gæren ud' },
        ],
      },
      { id: 's1', texts: [{ locale: 'en', text: 'Add the flour' }] },
    ]);
  });

  it('returns the base ingredients with their ids and every name', async () => {
    const authoring = await build().findVariationsForAuthoring(
      'r1',
      UNRESTRICTED,
    );

    expect(authoring.baseIngredients).toEqual([
      {
        id: 'i-yeast',
        quantity: 1,
        unit: 'g',
        pantryCategory: 'baking',
        names: [
          { locale: 'en', name: 'Fresh Yeast' },
          { locale: 'da', name: 'Frisk gær' },
        ],
      },
    ]);
  });

  it('returns each variation as the differences it stores, not as a resolved recipe', async () => {
    // The distractor: returning the recipe cooked that way would look right on
    // screen and lose which two of eighteen steps the author actually changed.
    const authoring = await build().findVariationsForAuthoring(
      'r1',
      UNRESTRICTED,
    );

    expect(authoring.variations).toEqual([
      {
        id: 'v1',
        sortOrder: 0,
        prepTime: 180,
        cookTime: null,
        texts: [
          { locale: 'en', name: '10 g yeast', note: 'The quickest.' },
          { locale: 'da', name: '10 g gær', note: 'Den hurtigste.' },
        ],
        ingredients: [
          {
            ingredientId: 'i-yeast',
            removed: false,
            quantity: 10,
            unit: null,
            pantryCategory: null,
            sortOrder: 0,
            names: [],
          },
          {
            ingredientId: null,
            removed: false,
            quantity: 8,
            unit: 'g',
            pantryCategory: 'baking',
            sortOrder: 1,
            names: [
              { locale: 'en', name: 'Sugar' },
              { locale: 'da', name: 'Sukker' },
            ],
          },
        ],
        steps: [
          {
            stepId: 's0',
            removed: false,
            afterPosition: null,
            texts: [
              { locale: 'en', text: 'Stir the sugar in too' },
              { locale: 'da', text: 'Rør også sukkeret i' },
            ],
          },
        ],
      },
    ]);
  });

  it('is filtered by the same visibility rule as the recipe itself', async () => {
    // This route hands out a private recipe's whole method in every language.
    // Leaving it unfiltered would be the /translations mistake again.
    await expect(
      build(null).findVariationsForAuthoring('r1', UNRESTRICTED),
    ).rejects.toThrow(NotFoundException);
  });
});
