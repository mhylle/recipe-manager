import { NotFoundException } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingListRepository } from './shopping-list.repository';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { RecipeService } from '../recipe/recipe.service';
import { PantryService } from '../pantry/pantry.service';
import { StaplesService } from '../staples/staples.service';

/**
 * A shopping list you can come back to.
 *
 * Reported as "it is only there in the UI", which was nearly right: the row was
 * always written, but the only way to read one back was by id, and nothing gave
 * out the id after the page that generated it was left. The list existed and was
 * unreachable, which from the shop is the same as not existing.
 */
describe('ShoppingListService — the current list', () => {
  const PANTRY = 'p-home';

  const build = (repository: Partial<Record<string, jest.Mock>>) =>
    new ShoppingListService(
      repository as unknown as ShoppingListRepository,
      {
        findById: jest.fn().mockResolvedValue({ id: 'plan-1', entries: [] }),
      } as unknown as MealPlanService,
      {} as RecipeService,
      { findAll: jest.fn().mockResolvedValue([]) } as unknown as PantryService,
      {
        getStaples: jest.fn().mockResolvedValue({ items: [] }),
      } as unknown as StaplesService,
    );

  it('hands back the kitchen’s current list', async () => {
    const findCurrent = jest
      .fn()
      .mockResolvedValue({ id: 'list-1', items: [] });
    const service = build({ findCurrent });

    await expect(service.getCurrent(PANTRY)).resolves.toEqual({
      id: 'list-1',
      items: [],
    });
    expect(findCurrent).toHaveBeenCalledWith(PANTRY);
  });

  it('says so plainly when a kitchen has none', async () => {
    // Null, not a 404: "you have not made one yet" is an ordinary state for a
    // page whose whole job is to offer making one.
    const service = build({ findCurrent: jest.fn().mockResolvedValue(null) });

    await expect(service.getCurrent(PANTRY)).resolves.toBeNull();
  });

  it('archives the one that was current when a new one is generated', async () => {
    // Otherwise every generate leaves another unarchived list behind that
    // nothing will ever show again — the pile grows and the newest wins by
    // accident rather than by design.
    const archiveCurrent = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({ id: 'list-2', items: [] });
    const service = build({ archiveCurrent, create });

    await service.generate(PANTRY, 'plan-1');

    expect(archiveCurrent).toHaveBeenCalledWith(PANTRY);
    expect(archiveCurrent.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });

  it('archives a list on request', async () => {
    const archive = jest.fn().mockResolvedValue({ id: 'list-1', items: [] });
    // Archiving reads the list first now, to put its shopping into the pantry
    // — and to refuse to do that twice. See shopping-list-restock.spec.ts.
    const findById = jest
      .fn()
      .mockResolvedValue({ id: 'list-1', items: [], archivedAt: null });
    const service = build({ archive, findById });

    await service.archive(PANTRY, 'list-1');

    // Scoped: archiving is a write, and a list id from another household must
    // not be writable.
    expect(archive).toHaveBeenCalledWith(PANTRY, 'list-1');
  });
});

/**
 * Cross-kitchen access.
 *
 * `findById` and `toggleItem` took a pantryId and passed only the id down, so
 * any signed-in account could read — and tick items on — another household's
 * list by guessing or keeping an id. The meal-plan repository scopes its reads
 * for exactly this reason; this one did not.
 */
describe('ShoppingListService — a list belongs to one kitchen', () => {
  const build = (repository: Partial<Record<string, jest.Mock>>) =>
    new ShoppingListService(
      repository as unknown as ShoppingListRepository,
      {} as MealPlanService,
      {} as RecipeService,
      {} as PantryService,
      {} as StaplesService,
    );

  it('reads within the kitchen, not by bare id', async () => {
    const findById = jest.fn().mockResolvedValue({ id: 'list-1', items: [] });
    const service = build({ findById });

    await service.findById('p-home', 'list-1');

    expect(findById).toHaveBeenCalledWith('p-home', 'list-1');
  });

  it('ticks an item within the kitchen, not by bare id', async () => {
    const toggleItemByIndex = jest
      .fn()
      .mockResolvedValue({ id: 'list-1', items: [] });
    const service = build({ toggleItemByIndex });

    await service.toggleItem('p-home', 'list-1', 2);

    expect(toggleItemByIndex).toHaveBeenCalledWith('p-home', 'list-1', 2);
  });

  it('lets the repository’s refusal reach the caller', async () => {
    const service = build({
      findById: jest.fn().mockRejectedValue(new NotFoundException('nope')),
    });

    await expect(service.findById('p-other', 'list-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
