import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Unit, PantryCategory } from '../shared/enums/index.js';

/**
 * Editing a recipe must not take its variations' ingredient changes with it.
 *
 * Ingredients were deleted and recreated on every save, and
 * `RecipeVariationIngredient.ingredientId` is `ON DELETE CASCADE` — so fixing a
 * typo in the ciabatta's name deleted the three rows saying its faster versions
 * use 3, 5 and 10 g of yeast. Nothing looked broken afterwards: the variations
 * kept their names, their notes, their added sugar and their step overrides, and
 * only the quantity quietly went back to the base 1 g.
 *
 * The fix is the one steps already have — the payload says which existing
 * ingredient each row IS.
 */
describe('RecipeRepository.update — ingredients keep their identity', () => {
  const existingIngredients = [
    { id: 'i0', sortOrder: 0, translations: [] },
    { id: 'i1', sortOrder: 1, translations: [] },
    { id: 'i2', sortOrder: 2, translations: [] },
  ];

  const ingredient = (
    name: string,
    quantity: number,
    id?: string,
  ): {
    id?: string;
    name: string;
    quantity: number;
    unit: Unit;
    pantryCategory: PantryCategory;
  } => ({
    ...(id ? { id } : {}),
    name,
    quantity,
    unit: Unit.G,
    pantryCategory: PantryCategory.OTHER,
  });

  const build = () => {
    const recipeRow = {
      id: 'r1',
      sourceLocale: 'en',
      instructionImages: [],
      difficulty: 'easy',
      tags: [],
      ingredients: existingIngredients,
      steps: [],
      variations: [],
      translations: [
        { locale: 'en', name: 'R', description: '', instructions: [] },
      ],
      createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
    };

    const tx = {
      recipeIngredient: {
        update: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id }),
          ),
        create: jest.fn().mockResolvedValue({ id: 'new-ingredient' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      recipeIngredientTranslation: { upsert: jest.fn().mockResolvedValue({}) },
      recipeStep: {
        update: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      recipeStepTranslation: { upsert: jest.fn() },
      recipeTranslation: { upsert: jest.fn().mockResolvedValue({}) },
      recipe: { update: jest.fn().mockResolvedValue({ id: 'r1' }) },
      recipeVariationStep: { count: jest.fn().mockResolvedValue(0) },
      recipeVariationIngredient: { count: jest.fn().mockResolvedValue(0) },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      recipe: {
        findUnique: jest.fn().mockResolvedValue(recipeRow),
        findFirst: jest.fn().mockResolvedValue(recipeRow),
      },
    };

    return {
      tx,
      repository: new RecipeRepository(prisma as unknown as PrismaService),
    };
  };

  it('updates the named rows in place rather than deleting the list', async () => {
    // The whole defect in one assertion: a delete-and-recreate takes every
    // variation's "10 g of yeast" with it, through the FK cascade, in silence.
    const { tx, repository } = build();

    await repository.update(
      'r1',
      {
        ingredients: [
          ingredient('Fresh Yeast', 1, 'i0'),
          ingredient('Water', 350, 'i1'),
          ingredient('Salt', 8, 'i2'),
        ],
      },
      { locale: 'en' },
    );

    expect(tx.recipeIngredient.create).not.toHaveBeenCalled();
    const updated = tx.recipeIngredient.update.mock.calls.map(
      ([args]: [{ where: { id: string } }]) => args.where.id,
    );
    expect(updated).toEqual(['i0', 'i1', 'i2']);
    // Nothing was dropped, so the sweep must not name any of them.
    const [swept] = tx.recipeIngredient.deleteMany.mock.calls[0] as [
      { where: { id: { notIn: string[] } } },
    ];
    expect(swept.where.id.notIn).toEqual(['i0', 'i1', 'i2']);
  });

  it('moves the named rows rather than rewriting whatever sits at each position', async () => {
    // The distractor: a positional implementation passes the test above and
    // still moves an override the first time an ingredient is inserted.
    const { tx, repository } = build();

    await repository.update(
      'r1',
      {
        ingredients: [
          ingredient('Fresh Yeast', 1, 'i0'),
          ingredient('Sugar', 4),
          ingredient('Water', 350, 'i1'),
          ingredient('Salt', 8, 'i2'),
        ],
      },
      { locale: 'en' },
    );

    const moved = tx.recipeIngredient.update.mock.calls.map(
      ([args]: [{ where: { id: string }; data: { sortOrder: number } }]) => [
        args.where.id,
        args.data.sortOrder,
      ],
    );
    expect(moved).toEqual(
      expect.arrayContaining([
        ['i0', 0],
        ['i1', 2],
        ['i2', 3],
      ]),
    );
    expect(tx.recipeIngredient.create).toHaveBeenCalledTimes(1);
  });

  it('deletes only the rows the payload dropped', async () => {
    const { tx, repository } = build();

    await repository.update(
      'r1',
      {
        ingredients: [
          ingredient('Fresh Yeast', 1, 'i0'),
          ingredient('Salt', 8, 'i2'),
        ],
      },
      { locale: 'en' },
    );

    const [swept] = tx.recipeIngredient.deleteMany.mock.calls[0] as [
      { where: { id: { notIn: string[] } } },
    ];
    expect(swept.where.id.notIn).toEqual(['i0', 'i2']);
  });

  it('refuses an ambiguous edit rather than guessing, when overrides exist', async () => {
    // No ids and a different count: nothing in the payload says which existing
    // ingredient each row is, and a variation is pointing at them. The same
    // refusal the method already gives, for the same reason.
    const { tx, repository } = build();
    tx.recipeVariationIngredient.count.mockResolvedValue(3);

    await expect(
      repository.update(
        'r1',
        {
          ingredients: [
            ingredient('Fresh Yeast', 1),
            ingredient('Water', 350),
            ingredient('Salt', 8),
            ingredient('Plain Flour', 400),
          ],
        },
        { locale: 'en' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('still allows an id-less edit that changes no positions', async () => {
    // Older clients — the MCP server among them — send no ids at all. Position
    // still identifies a row when the count is unchanged, and updating in place
    // keeps every id, so the overrides survive.
    const { tx, repository } = build();

    await repository.update(
      'r1',
      {
        ingredients: [
          ingredient('Fresh Yeast', 2),
          ingredient('Water', 360),
          ingredient('Salt', 9),
        ],
      },
      { locale: 'en' },
    );

    const updated = tx.recipeIngredient.update.mock.calls.map(
      ([args]: [{ where: { id: string } }]) => args.where.id,
    );
    expect(updated).toEqual(['i0', 'i1', 'i2']);
    expect(tx.recipeIngredient.create).not.toHaveBeenCalled();
  });

  it('keeps a name in a language the edit did not mention', async () => {
    // Delete-and-recreate lost every translation the payload did not restate.
    // Updating in place means editing the English name no longer blanks the
    // Danish one — the upsert only touches the locales that were sent.
    const { tx, repository } = build();

    await repository.update(
      'r1',
      { ingredients: [ingredient('Fresh Yeast', 1, 'i0')] },
      { locale: 'en' },
    );

    const locales = tx.recipeIngredientTranslation.upsert.mock.calls.map(
      ([args]: [{ where: { ingredientId_locale: { locale: string } } }]) =>
        args.where.ingredientId_locale.locale,
    );
    expect(locales).toEqual(['en']);
  });
});
