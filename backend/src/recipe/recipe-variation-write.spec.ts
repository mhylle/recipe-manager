import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { Unit, PantryCategory } from '../shared/enums/index.js';

/**
 * Writing a variation.
 *
 * REPLACE, not merge: a save sends the whole set, so a variation the author
 * deleted actually disappears. Merging would leave removed ones alive with
 * nothing in the UI pointing at them, and a meal plan could still be holding
 * their ids.
 */
describe('RecipeRepository.replaceVariations', () => {
  const build = () => {
    const created: Record<string, unknown>[] = [];
    const tx = {
      recipeVariation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest
          .fn()
          .mockImplementation((args: Record<string, unknown>) => {
            created.push(args);
            return Promise.resolve({ id: `v${created.length}` });
          }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      recipe: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'r1',
          sourceLocale: 'en',
          instructionImages: [],
          difficulty: 'easy',
          tags: [],
          ingredients: [],
          steps: [],
          variations: [],
          translations: [],
          createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
        }),
      },
    };
    return {
      tx,
      created,
      repository: new RecipeRepository(prisma as unknown as PrismaService),
    };
  };

  const tenGrams = {
    texts: [
      {
        locale: 'en',
        name: '10 g yeast — same day',
        note: 'Two to four hours.',
      },
      {
        locale: 'da',
        name: '10 g gær — samme dag',
        note: 'To til fire timer.',
      },
    ],
    prepTime: 180,
    ingredients: [
      { ingredientId: 'i-yeast', quantity: 10 },
      {
        quantity: 8,
        unit: Unit.G,
        pantryCategory: PantryCategory.BAKING,
        names: [
          { locale: 'en', name: 'Sugar' },
          { locale: 'da', name: 'Sukker' },
        ],
      },
    ],
    steps: [
      {
        stepId: 's0',
        texts: [{ locale: 'en', text: 'Stir the sugar in too.' }],
      },
    ],
  };

  it('clears what was there before writing the new set', async () => {
    const { tx, repository } = build();

    await repository.replaceVariations('r1', [tenGrams]);

    expect(tx.recipeVariation.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: 'r1' },
    });
    expect(
      tx.recipeVariation.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.recipeVariation.create.mock.invocationCallOrder[0]);
  });

  it('writes the name and reason in every language given', async () => {
    const { created, repository } = build();

    await repository.replaceVariations('r1', [tenGrams]);

    const data = created[0].data as {
      translations: {
        create: { locale: string; name: string; note: string }[];
      };
    };
    expect(data.translations.create).toEqual([
      {
        locale: 'en',
        name: '10 g yeast — same day',
        note: 'Two to four hours.',
      },
      {
        locale: 'da',
        name: '10 g gær — samme dag',
        note: 'To til fire timer.',
      },
    ]);
  });

  it('keeps a change to an existing ingredient pointed at that ingredient', async () => {
    const { created, repository } = build();

    await repository.replaceVariations('r1', [tenGrams]);

    const data = created[0].data as {
      ingredients: {
        create: { ingredientId: string | null; quantity: number }[];
      };
    };
    expect(data.ingredients.create[0]).toMatchObject({
      ingredientId: 'i-yeast',
      quantity: 10,
    });
  });

  it('writes an added ingredient with no base to point at, and its names', async () => {
    const { created, repository } = build();

    await repository.replaceVariations('r1', [tenGrams]);

    const data = created[0].data as {
      ingredients: {
        create: {
          ingredientId: string | null;
          translations: { create: { locale: string; name: string }[] };
        }[];
      };
    };
    const sugar = data.ingredients.create[1];
    expect(sugar.ingredientId).toBeNull();
    expect(sugar.translations.create).toEqual([
      { locale: 'en', name: 'Sugar' },
      { locale: 'da', name: 'Sukker' },
    ]);
  });

  it('addresses an overridden step by id, never by position', async () => {
    const { created, repository } = build();

    await repository.replaceVariations('r1', [tenGrams]);

    const data = created[0].data as {
      steps: {
        create: { stepId: string | null; afterPosition: number | null }[];
      };
    };
    expect(data.steps.create[0]).toMatchObject({ stepId: 's0' });
  });
});
