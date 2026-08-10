import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Inserting a step must not move somebody's variation overrides.
 *
 * Steps were upserted by (recipeId, sortOrder), so adding one in the middle
 * rewrote existing rows in place: the row that had been step 4 kept its id and
 * took step 5's text, and every variation pointing at it silently began
 * overriding the wrong instruction. No error, and the recipe still read
 * correctly for anyone not using a variation.
 *
 * The fix is that the client says which existing step each position IS.
 */
describe('RecipeRepository.update — steps keep their identity', () => {
  const existingSteps = [
    { id: 's0', sortOrder: 0 },
    { id: 's1', sortOrder: 1 },
    { id: 's2', sortOrder: 2 },
  ];

  const build = () => {
    const tx = {
      recipeStep: {
        update: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id }),
          ),
        create: jest.fn().mockResolvedValue({ id: 'new-step' }),
        upsert: jest.fn().mockResolvedValue({ id: 'upserted' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue(existingSteps),
      },
      recipeStepTranslation: { upsert: jest.fn().mockResolvedValue({}) },
      recipeTranslation: { upsert: jest.fn().mockResolvedValue({}) },
      recipeIngredient: { deleteMany: jest.fn(), create: jest.fn() },
      recipeIngredientTranslation: { upsert: jest.fn() },
      recipe: { update: jest.fn().mockResolvedValue({ id: 'r1' }) },
      recipeVariationStep: { count: jest.fn().mockResolvedValue(0) },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      recipe: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1',
          sourceLocale: 'en',
          instructionImages: [],
          difficulty: 'easy',
          tags: [],
          ingredients: [],
          steps: existingSteps.map((s) => ({
            ...s,
            imageUrl: null,
            translations: [],
          })),
          variations: [],
          reactions: [],
          translations: [
            { locale: 'en', name: 'R', description: '', instructions: [] },
          ],
          createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'r1',
          sourceLocale: 'en',
          instructionImages: [],
          difficulty: 'easy',
          tags: [],
          ingredients: [],
          steps: existingSteps.map((s) => ({
            ...s,
            imageUrl: null,
            translations: [],
          })),
          variations: [],
          reactions: [],
          translations: [
            { locale: 'en', name: 'R', description: '', instructions: [] },
          ],
          createdBy: { id: 'u1', displayName: 'A', email: 'a@b.c' },
        }),
      },
    };
    return {
      tx,
      repository: new RecipeRepository(prisma as unknown as PrismaService),
    };
  };

  it('moves the named steps rather than rewriting whatever sits at each position', async () => {
    const { tx, repository } = build();

    // A step inserted between the first and second: positions 1..3 all shift.
    await repository.update(
      'r1',
      {
        instructions: ['One', 'BRAND NEW', 'Two', 'Three'],
        stepIds: ['s0', null, 's1', 's2'],
      },
      { locale: 'en' },
    );

    // s1 moves to position 2 and s2 to position 3 — they are not overwritten
    // in place with text that belongs to a different step.
    const moved = tx.recipeStep.update.mock.calls.map(
      ([args]: [{ where: { id: string }; data: { sortOrder: number } }]) => [
        args.where.id,
        args.data.sortOrder,
      ],
    );
    expect(moved).toEqual(
      expect.arrayContaining([
        ['s0', 0],
        ['s1', 2],
        ['s2', 3],
      ]),
    );
    expect(tx.recipeStep.create).toHaveBeenCalledTimes(1);
  });

  it('refuses an ambiguous edit rather than guessing, when overrides exist', async () => {
    const { tx, repository } = build();
    tx.recipeVariationStep.count.mockResolvedValue(2);

    // No stepIds, and the count changed: nothing in the payload says which
    // existing step each position is, and two variations are pointing at them.
    await expect(
      repository.update(
        'r1',
        { instructions: ['One', 'Two', 'Three', 'Four'] },
        { locale: 'en' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('still allows a plain text edit that changes no positions', async () => {
    const { repository } = build();

    await expect(
      repository.update(
        'r1',
        { instructions: ['One', 'Two edited', 'Three'] },
        { locale: 'en' },
      ),
    ).resolves.toBeDefined();
  });
});
