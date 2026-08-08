import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { UNRESTRICTED } from './recipe-visibility';

/**
 * Serving the method from step rows instead of two parallel arrays.
 *
 * The API shape does not change here: callers still receive `instructions` and
 * `instructionImages` as arrays in step order. What changes is where they come
 * from, and that a step now has an id something can point at.
 */
describe('RecipeRepository — assembling the method from step rows', () => {
  const step = (
    sortOrder: number,
    texts: Record<string, string>,
    imageUrl: string | null = null,
  ) => ({
    id: `s${sortOrder}`,
    sortOrder,
    imageUrl,
    translations: Object.entries(texts).map(([locale, text]) => ({
      id: `st-${sortOrder}-${locale}`,
      locale,
      text,
      stepId: `s${sortOrder}`,
    })),
  });

  const row = (steps: ReturnType<typeof step>[]) => ({
    id: 'r1',
    servings: 4,
    instructionImages: [],
    prepTime: 5,
    cookTime: 10,
    difficulty: 'easy',
    tags: [],
    imageUrl: null,
    thumbnailUrl: null,
    sourceLocale: 'en',
    createdById: 'u1',
    isPrivate: false,
    pantryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [],
    steps,
    translations: [
      {
        id: 't-en',
        locale: 'en',
        name: 'Ciabatta',
        description: 'Bread',
        instructions: [],
        recipeId: 'r1',
      },
      {
        id: 't-da',
        locale: 'da',
        name: 'Ciabatta',
        description: 'Brød',
        instructions: [],
        recipeId: 'r1',
      },
    ],
    createdBy: { id: 'u1', displayName: 'A Cook', email: 'a@b.c' },
  });

  const build = (steps: ReturnType<typeof step>[]) => {
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue(row(steps)) },
    };
    return new RecipeRepository(prisma as unknown as PrismaService);
  };

  it('returns the steps in order, in the requested language', async () => {
    const repository = build([
      step(0, { en: 'Stir the yeast in', da: 'Rør gæren ud' }),
      step(1, { en: 'Add the flour', da: 'Tilsæt melet' }),
      step(2, { en: 'Cover the bowl', da: 'Dæk skålen til' }),
    ]);

    const recipe = await repository.findById('r1', 'da', UNRESTRICTED);

    expect(recipe.instructions).toEqual([
      'Rør gæren ud',
      'Tilsæt melet',
      'Dæk skålen til',
    ]);
  });

  it('orders by sortOrder, not by the order rows arrive in', async () => {
    // The distractor: an implementation that maps the array as given passes
    // every other test here and scrambles the method the first time the
    // database returns rows in a different order.
    const repository = build([
      step(2, { en: 'Cover the bowl' }),
      step(0, { en: 'Stir the yeast in' }),
      step(1, { en: 'Add the flour' }),
    ]);

    const recipe = await repository.findById('r1', 'en', UNRESTRICTED);

    expect(recipe.instructions).toEqual([
      'Stir the yeast in',
      'Add the flour',
      'Cover the bowl',
    ]);
  });

  it('falls back per step, so an untranslated step is not a hole in the method', async () => {
    // Whole-translation fallback could only choose one language for the lot.
    // Per step, a half-translated recipe reads in Danish where it can and in the
    // source language where it cannot — never blank, and never a missing step.
    const repository = build([
      step(0, { en: 'Stir the yeast in', da: 'Rør gæren ud' }),
      step(1, { en: 'Add the flour' }),
      step(2, { en: 'Cover the bowl', da: 'Dæk skålen til' }),
    ]);

    const recipe = await repository.findById('r1', 'da', UNRESTRICTED);

    expect(recipe.instructions).toEqual([
      'Rør gæren ud',
      'Add the flour',
      'Dæk skålen til',
    ]);
  });

  it('keeps each photograph on its own step, and pads where there are none', async () => {
    // The ciabatta: 18 steps, 13 photographs. The array stays positional for
    // callers, so a short tail must be padded rather than shifted.
    const repository = build([
      step(0, { en: 'One' }, '/img/a.webp'),
      step(1, { en: 'Two' }, null),
      step(2, { en: 'Three' }, '/img/c.webp'),
      step(3, { en: 'Four' }, null),
    ]);

    const recipe = await repository.findById('r1', 'en', UNRESTRICTED);

    expect(recipe.instructionImages).toEqual([
      '/img/a.webp',
      '',
      '/img/c.webp',
      '',
    ]);
  });

  it('has no method at all when a recipe has no steps', async () => {
    const repository = build([]);

    const recipe = await repository.findById('r1', 'en', UNRESTRICTED);

    expect(recipe.instructions).toEqual([]);
    expect(recipe.instructionImages).toEqual([]);
  });
});

/**
 * Writing the method as rows.
 *
 * Identity has to SURVIVE an edit. A variation will point at a step id, so a
 * save that deleted and recreated every step would silently orphan every
 * override the first time somebody fixed a typo.
 */
describe('RecipeRepository — writing steps', () => {
  const payload = {
    name: 'Ciabatta',
    description: 'Bread',
    servings: 1,
    instructions: ['Stir', 'Add flour', 'Cover'],
    instructionImages: ['/img/a.webp', '', '/img/c.webp'],
    prepTime: 5,
    cookTime: 10,
    difficulty: 'easy' as const,
    tags: [],
    ingredients: [],
  };

  it('creates a row per step, carrying its position, photograph and text', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'r1',
      steps: [],
      translations: [],
      ingredients: [],
      instructionImages: [],
      sourceLocale: 'en',
      createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
      difficulty: 'easy',
      tags: [],
    });
    const repository = new RecipeRepository({
      recipe: { create },
    } as unknown as PrismaService);

    await repository.create('u1', payload, {
      sourceLocale: 'en',
      translations: [
        {
          locale: 'da',
          name: 'Ciabatta',
          description: 'Brød',
          instructions: ['Rør', 'Tilsæt mel', 'Dæk til'],
          ingredientNames: [],
        },
      ],
    });

    type StepCreate = {
      sortOrder: number;
      imageUrl: string | null;
      translations: { create: { locale: string; text: string }[] };
    };
    const [args] = create.mock.calls[0] as [
      { data: { steps: { create: StepCreate[] } } },
    ];
    const steps = args.data.steps.create;

    expect(steps.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
    // Empty string means "no photograph", and must not be stored as one.
    expect(steps.map((s) => s.imageUrl)).toEqual([
      '/img/a.webp',
      null,
      '/img/c.webp',
    ]);
    expect(steps[1].translations.create).toEqual([
      { locale: 'en', text: 'Add flour' },
      { locale: 'da', text: 'Tilsæt mel' },
    ]);
  });
});
