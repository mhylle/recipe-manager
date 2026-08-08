import { RecipeRepository } from './recipe.repository';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Editing a variation must not un-plan the dinners already planned as it.
 *
 * `replaceVariations` deleted every row and wrote the set again, and
 * `MealPlanEntry.variationId` is `ON DELETE SET NULL` — so correcting a typo in
 * "10 g yeast — same day" turned every meal planned that way back into the
 * recipe as written. Silently: the entry stays, the recipe stays, and only the
 * two-hour method the cook actually chose is gone.
 *
 * A variation the author kept therefore keeps its id. Its overrides are still
 * rewritten wholesale — nothing points at those, and rewriting them is how an
 * override is removed.
 */
describe('RecipeRepository.replaceVariations — a kept variation keeps its id', () => {
  const named = (id: string | undefined, name: string) => ({
    ...(id ? { id } : {}),
    texts: [{ locale: 'en', name, note: '' }],
    steps: [{ stepId: 's0', texts: [{ locale: 'en', text: 'Stir.' }] }],
  });

  const build = (existing = ['v1', 'v2']) => {
    const created: Record<string, unknown>[] = [];
    const tx = {
      recipeVariation: {
        findMany: jest.fn().mockResolvedValue(existing.map((id) => ({ id }))),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id }),
          ),
        create: jest
          .fn()
          .mockImplementation((args: Record<string, unknown>) => {
            created.push(args);
            return Promise.resolve({ id: `new-${created.length}` });
          }),
      },
      recipeVariationTranslation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      recipeVariationIngredient: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      recipeVariationStep: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    return {
      tx,
      created,
      repository: new RecipeRepository(prisma as unknown as PrismaService),
    };
  };

  it('updates a variation the author kept instead of recreating it', async () => {
    // The whole defect in one assertion: a recreated variation has a new id, so
    // every meal plan entry pointing at the old one is set to null.
    const { tx, repository } = build();

    await repository.replaceVariations('r1', [named('v1', '10 g yeast')]);

    expect(tx.recipeVariation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1' } }),
    );
    expect(tx.recipeVariation.create).not.toHaveBeenCalled();
  });

  it('deletes only the variations the author dropped', async () => {
    const { tx, repository } = build(['v1', 'v2', 'v3']);

    await repository.replaceVariations('r1', [
      named('v1', '10 g yeast'),
      named('v3', '1 g yeast'),
    ]);

    expect(tx.recipeVariation.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: 'r1', id: { notIn: ['v1', 'v3'] } },
    });
  });

  it('still creates one the author has just added', async () => {
    const { tx, repository } = build();

    await repository.replaceVariations('r1', [
      named('v1', '10 g yeast'),
      named(undefined, 'A brand new way'),
    ]);

    expect(tx.recipeVariation.update).toHaveBeenCalledTimes(1);
    expect(tx.recipeVariation.create).toHaveBeenCalledTimes(1);
  });

  it('rewrites a kept variation’s overrides wholesale', async () => {
    // Removing an override IS deleting the row. Nothing points at these, so
    // there is no identity to preserve — unlike the variation itself.
    const { tx, repository } = build();

    await repository.replaceVariations('r1', [named('v1', '10 g yeast')]);

    expect(tx.recipeVariationStep.deleteMany).toHaveBeenCalledWith({
      where: { variationId: 'v1' },
    });
    expect(tx.recipeVariationIngredient.deleteMany).toHaveBeenCalledWith({
      where: { variationId: 'v1' },
    });
    expect(tx.recipeVariationTranslation.deleteMany).toHaveBeenCalledWith({
      where: { variationId: 'v1' },
    });
    const [stepArgs] = tx.recipeVariationStep.create.mock.calls[0] as [
      { data: { variationId: string; stepId: string | null } },
    ];
    expect(stepArgs.data).toMatchObject({ variationId: 'v1', stepId: 's0' });
  });

  it('refuses an id that belongs to a different recipe', async () => {
    // Without this, naming another recipe's variation id would move it: the
    // update would succeed and quietly re-parent somebody else's variation.
    const { repository } = build(['v1']);

    await expect(
      repository.replaceVariations('r1', [named('someone-elses', 'Mine now')]),
    ).rejects.toThrow(BadRequestException);
  });
});
