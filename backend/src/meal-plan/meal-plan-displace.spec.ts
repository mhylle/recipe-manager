import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanRepository } from './meal-plan.repository';
import { DayOfWeek, MealType } from '../shared/enums/index.js';

/**
 * Planning into a slot that already holds something.
 *
 * A slot may hold more than one meal on purpose — a large lunch and a small one
 * are both lunch — so adding alongside is the default and displacing is
 * something the caller asks for. These tests are mostly about the guard that
 * stops a stale index from throwing away a meal nobody meant to lose.
 */
describe('MealPlanService.addEntry with displacement', () => {
  let service: MealPlanService;
  let repository: {
    addEntry: jest.Mock;
    addEntryDisplacing: jest.Mock;
  };

  const PANTRY = 'p-home';
  const PLAN = 'plan-1';

  const dto = (extra: Record<string, unknown> = {}) => ({
    day: DayOfWeek.TUESDAY,
    meal: MealType.DINNER,
    recipeId: 'r-new',
    servings: 4,
    ...extra,
  });

  beforeEach(() => {
    repository = {
      addEntry: jest.fn().mockResolvedValue({ id: PLAN, entries: [] }),
      addEntryDisplacing: jest
        .fn()
        .mockResolvedValue({ id: PLAN, entries: [] }),
    };
    service = new MealPlanService(repository as unknown as MealPlanRepository);
  });

  describe('when nothing is displaced', () => {
    it('adds alongside whatever is already in the slot', async () => {
      // The default, and deliberately so: two meals in one slot is a thing
      // people plan, not a mistake to prevent.
      await service.addEntry(PANTRY, PLAN, dto());

      expect(repository.addEntry).toHaveBeenCalledWith(PANTRY, PLAN, {
        day: DayOfWeek.TUESDAY,
        meal: MealType.DINNER,
        recipeId: 'r-new',
        servings: 4,
      });
      expect(repository.addEntryDisplacing).not.toHaveBeenCalled();
    });
  });

  describe('replacing what was there', () => {
    it('removes the named entry and adds the new one in one call', async () => {
      // One repository call, so a failure cannot leave the plan with the old
      // meal deleted and the new one never written.
      await service.addEntry(
        PANTRY,
        PLAN,
        dto({ displace: { index: 2, expectRecipeId: 'r-lasagne' } }),
      );

      expect(repository.addEntryDisplacing).toHaveBeenCalledWith(
        PANTRY,
        PLAN,
        expect.objectContaining({ recipeId: 'r-new' }),
        { index: 2, expectRecipeId: 'r-lasagne', to: undefined },
      );
      expect(repository.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('moving what was there', () => {
    it('passes the destination through', async () => {
      await service.addEntry(
        PANTRY,
        PLAN,
        dto({
          displace: {
            index: 2,
            expectRecipeId: 'r-lasagne',
            to: { day: DayOfWeek.WEDNESDAY, meal: MealType.LUNCH },
          },
        }),
      );

      expect(repository.addEntryDisplacing).toHaveBeenCalledWith(
        PANTRY,
        PLAN,
        expect.objectContaining({ recipeId: 'r-new' }),
        {
          index: 2,
          expectRecipeId: 'r-lasagne',
          to: { day: DayOfWeek.WEDNESDAY, meal: MealType.LUNCH },
        },
      );
    });

    it('refuses to move an entry onto the slot being planned', async () => {
      // Moving it to the very slot the new meal is about to take would either
      // undo the displacement or double-book it, depending on write order.
      await expect(
        service.addEntry(
          PANTRY,
          PLAN,
          dto({
            displace: {
              index: 2,
              expectRecipeId: 'r-lasagne',
              to: { day: DayOfWeek.TUESDAY, meal: MealType.DINNER },
            },
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.addEntryDisplacing).not.toHaveBeenCalled();
    });
  });

  describe('the stale-index guard', () => {
    it('passes the expected recipe down so the repository can verify it', async () => {
      // The distractor: an implementation that dropped expectRecipeId would
      // pass every other test here and still delete a housemate's dinner when
      // two people edit the plan at once.
      await service.addEntry(
        PANTRY,
        PLAN,
        dto({ displace: { index: 0, expectRecipeId: 'r-lasagne' } }),
      );

      const [, , , displace] = repository.addEntryDisplacing.mock
        .calls[0] as unknown[];
      expect(displace).toMatchObject({ expectRecipeId: 'r-lasagne' });
    });

    it('lets the repository’s refusal reach the caller', async () => {
      repository.addEntryDisplacing.mockRejectedValue(
        new NotFoundException('That meal is no longer there.'),
      );

      await expect(
        service.addEntry(
          PANTRY,
          PLAN,
          dto({ displace: { index: 9, expectRecipeId: 'r-gone' } }),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
