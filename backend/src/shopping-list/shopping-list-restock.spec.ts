import { ShoppingListService } from './shopping-list.service';
import { ShoppingListRepository } from './shopping-list.repository';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { RecipeService } from '../recipe/recipe.service';
import { PantryService } from '../pantry/pantry.service';
import { StaplesService } from '../staples/staples.service';
import { Unit, PantryCategory } from '../shared/enums/index.js';

/**
 * Putting the shopping away when the shopping is done.
 *
 * Generating a list already DEDUCTS what the pantry holds; nothing ever put the
 * shopping back, so the pantry stayed frozen at what it held before the shop and
 * the next list bought it all over again. "Done shopping" is the moment a cook
 * says the trolley came home, so that is where this belongs.
 */
describe('ShoppingListService.archive — stocking the pantry', () => {
  const PANTRY = 'p-home';
  const LIST = 'list-1';

  const build = (
    items: {
      name: string;
      quantity: number;
      unit: Unit;
      category?: PantryCategory;
      checked: boolean;
    }[],
    held: {
      id: string;
      name: string;
      quantity: number;
      unit: Unit;
      category: PantryCategory;
    }[] = [],
    archivedAt: string | null = null,
  ) => {
    const list = {
      id: LIST,
      mealPlanId: 'plan-1',
      generatedDate: '2026-08-10T00:00:00.000Z',
      archivedAt,
      items,
    };
    const repository = {
      findById: jest.fn().mockResolvedValue(list),
      archive: jest.fn().mockResolvedValue({ ...list, archivedAt: 'now' }),
    };
    const pantry = {
      findAll: jest.fn().mockResolvedValue(held),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };

    const service = new ShoppingListService(
      repository as unknown as ShoppingListRepository,
      {} as MealPlanService,
      {} as RecipeService,
      pantry as unknown as PantryService,
      {} as StaplesService,
    );

    return { service, repository, pantry };
  };

  it('adds a ticked-off item to what the pantry already holds', async () => {
    const { service, pantry } = build(
      [{ name: 'Flour', quantity: 1000, unit: Unit.G, checked: true }],
      [
        {
          id: 'p1',
          name: 'Flour',
          quantity: 500,
          unit: Unit.G,
          category: PantryCategory.BAKING,
        },
      ],
    );

    await service.archive(PANTRY, LIST);

    expect(pantry.update).toHaveBeenCalledWith(
      PANTRY,
      'p1',
      expect.objectContaining({ quantity: 1500 }),
    );
  });

  it('puts something new on the shelf it was filed under', async () => {
    const { service, pantry } = build([
      {
        name: 'Star Anise',
        quantity: 20,
        unit: Unit.G,
        category: PantryCategory.SPICES,
        checked: true,
      },
    ]);

    await service.archive(PANTRY, LIST);

    expect(pantry.create).toHaveBeenCalledWith(
      PANTRY,
      expect.objectContaining({
        name: 'Star Anise',
        quantity: 20,
        unit: Unit.G,
        category: PantryCategory.SPICES,
      }),
    );
  });

  it('leaves what was never ticked off out of the pantry', async () => {
    // The contract in one assertion: an unchecked line was not bought, and
    // stocking it tells the kitchen it owns something nobody carried home.
    const { service, pantry } = build([
      { name: 'Saffron', quantity: 1, unit: Unit.G, checked: false },
    ]);

    await service.archive(PANTRY, LIST);

    expect(pantry.create).not.toHaveBeenCalled();
    expect(pantry.update).not.toHaveBeenCalled();
  });

  it('does not stock a list that was already put away', async () => {
    // The distractor: archiving is reachable twice — a double click, a retry, a
    // second tab — and an implementation without this doubles the pantry every
    // time somebody presses it again.
    const { service, pantry, repository } = build(
      [{ name: 'Flour', quantity: 1000, unit: Unit.G, checked: true }],
      [],
      '2026-08-09T00:00:00.000Z',
    );

    await service.archive(PANTRY, LIST);

    expect(pantry.create).not.toHaveBeenCalled();
    expect(pantry.update).not.toHaveBeenCalled();
    // Still idempotent about the archiving itself.
    expect(repository.archive).toHaveBeenCalled();
  });

  it('still archives the list when there was nothing to put away', async () => {
    const { service, repository } = build([]);

    await service.archive(PANTRY, LIST);

    expect(repository.archive).toHaveBeenCalledWith(PANTRY, LIST);
  });

  it('archives even if the pantry write fails, rather than losing the list', async () => {
    // A shopping list that cannot be put away because stocking failed would
    // leave the kitchen stuck on a finished list with no way past it.
    const { service, repository, pantry } = build([
      { name: 'Flour', quantity: 1, unit: Unit.KG, checked: true },
    ]);
    pantry.create.mockRejectedValue(new Error('pantry is down'));

    await expect(service.archive(PANTRY, LIST)).resolves.toBeDefined();
    expect(repository.archive).toHaveBeenCalled();
  });
});
