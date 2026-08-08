import { ConflictException, NotFoundException } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanRepository } from './meal-plan.repository';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek, MealType } from '../shared/enums/index.js';

/**
 * Moving a planned meal to another day.
 *
 * The move exists on its own rather than as a side effect of planning something
 * else: "cook the lasagne on Wednesday instead" is not a displacement, and
 * routing it through addEntryDisplacing would delete and recreate the row for no
 * reason.
 *
 * The row is UPDATED, never recreated, so the entry keeps its position in the
 * plan. Positions are how every other route addresses entries, and a move that
 * renumbered them would silently change what a concurrent delete points at.
 */
describe('MealPlanService.moveEntry', () => {
  const PANTRY = 'p-home';
  const PLAN = 'plan-1';

  it('passes the destination and the stale-index guard to the repository', async () => {
    const repository = {
      moveEntryByIndex: jest.fn().mockResolvedValue({ id: PLAN, entries: [] }),
    };
    const service = new MealPlanService(
      repository as unknown as MealPlanRepository,
    );

    await service.moveEntry(PANTRY, PLAN, 2, {
      day: DayOfWeek.WEDNESDAY,
      meal: MealType.DINNER,
      expectRecipeId: 'r-lasagne',
    });

    // The distractor: dropping expectRecipeId passes any test that only checks
    // the destination, and moves a housemate's meal when indices have shifted.
    expect(repository.moveEntryByIndex).toHaveBeenCalledWith(PANTRY, PLAN, 2, {
      day: DayOfWeek.WEDNESDAY,
      meal: MealType.DINNER,
      expectRecipeId: 'r-lasagne',
    });
  });
});

describe('MealPlanRepository.moveEntryByIndex', () => {
  const PANTRY = 'p-home';
  const PLAN = 'plan-1';

  const rows = [
    { id: 'e0', recipeId: 'r-pancakes', day: 'monday', meal: 'dinner' },
    { id: 'e1', recipeId: 'r-soup', day: 'tuesday', meal: 'lunch' },
    { id: 'e2', recipeId: 'r-lasagne', day: 'monday', meal: 'dinner' },
  ];

  /** A prisma double whose $transaction runs the callback against the same tx. */
  const build = () => {
    const entry = {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn().mockResolvedValue(rows[2]),
    };
    const prisma = {
      mealPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: PLAN,
          weekStartDate: '2026-03-16',
          entries: [],
        }),
      },
      mealPlanEntry: entry,
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ mealPlanEntry: entry }),
      ),
    };
    return {
      entry,
      repository: new MealPlanRepository(prisma as unknown as PrismaService),
    };
  };

  it('moves the row at that position to the new slot', async () => {
    const { entry, repository } = build();

    await repository.moveEntryByIndex(PANTRY, PLAN, 2, {
      day: DayOfWeek.WEDNESDAY,
      meal: MealType.LUNCH,
      expectRecipeId: 'r-lasagne',
    });

    expect(entry.update).toHaveBeenCalledWith({
      where: { id: 'e2' },
      // Only the slot. Touching anything else would reorder the plan.
      data: { day: DayOfWeek.WEDNESDAY, meal: MealType.LUNCH },
    });
  });

  it('refuses when the meal at that position is not the one the caller saw', async () => {
    const { entry, repository } = build();

    await expect(
      repository.moveEntryByIndex(PANTRY, PLAN, 2, {
        day: DayOfWeek.WEDNESDAY,
        meal: MealType.LUNCH,
        expectRecipeId: 'r-something-else',
      }),
    ).rejects.toThrow(ConflictException);
    expect(entry.update).not.toHaveBeenCalled();
  });

  it('refuses a position that is not in the plan', async () => {
    const { entry, repository } = build();

    await expect(
      repository.moveEntryByIndex(PANTRY, PLAN, 9, {
        day: DayOfWeek.WEDNESDAY,
        meal: MealType.LUNCH,
        expectRecipeId: 'r-lasagne',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(entry.update).not.toHaveBeenCalled();
  });
});
