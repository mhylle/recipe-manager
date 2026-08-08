import { ShoppingListService } from '../shopping-list/shopping-list.service';
import { ShoppingListRepository } from '../shopping-list/shopping-list.repository';
import { MealPlanService } from './meal-plan.service';
import { RecipeService } from '../recipe/recipe.service';
import { PantryService } from '../pantry/pantry.service';
import { StaplesService } from '../staples/staples.service';
import {
  DayOfWeek,
  MealType,
  Unit,
  PantryCategory,
} from '../shared/enums/index.js';

/**
 * Buying for the version you actually planned.
 *
 * This is the half that makes variations true rather than decorative: plan the
 * ciabatta's 10 g option and the list has to contain 10 g of yeast and 8 g of
 * sugar. Resolve the base recipe instead and it says 1 g and no sugar at all —
 * which is exactly the shopping the reports complained was wrong.
 */
describe('ShoppingListService.generate — with variations', () => {
  const PANTRY = 'p-home';

  const entry = (variationId: string | null) => ({
    day: DayOfWeek.SATURDAY,
    meal: MealType.DINNER,
    recipeId: 'r-ciabatta',
    servings: 1,
    variationId,
  });

  /** The recipe as the resolver would return it for that variation. */
  const recipeFor = (variationId?: string) => ({
    id: 'r-ciabatta',
    name: 'No-Knead Ciabatta',
    servings: 1,
    ingredients:
      variationId === 'v-10g'
        ? [
            {
              name: 'Fresh Yeast',
              quantity: 10,
              unit: Unit.G,
              pantryCategory: PantryCategory.BAKING,
            },
            {
              name: 'Sugar',
              quantity: 8,
              unit: Unit.G,
              pantryCategory: PantryCategory.BAKING,
            },
          ]
        : [
            {
              name: 'Fresh Yeast',
              quantity: 1,
              unit: Unit.G,
              pantryCategory: PantryCategory.BAKING,
            },
          ],
  });

  const build = (entries: ReturnType<typeof entry>[]) => {
    const findByIdUnrestricted = jest
      .fn()
      .mockImplementation(
        (_id: string, _locale?: string, variationId?: string) =>
          Promise.resolve(recipeFor(variationId)),
      );
    const create = jest
      .fn()
      .mockImplementation((_p, data) => Promise.resolve(data));

    const service = new ShoppingListService(
      {
        create,
        archiveCurrent: jest.fn().mockResolvedValue(undefined),
      } as unknown as ShoppingListRepository,
      {
        findById: jest.fn().mockResolvedValue({ id: 'plan-1', entries }),
      } as unknown as MealPlanService,
      { findByIdUnrestricted } as unknown as RecipeService,
      { findAll: jest.fn().mockResolvedValue([]) } as unknown as PantryService,
      {
        getStaples: jest.fn().mockResolvedValue({ items: [] }),
      } as unknown as StaplesService,
    );
    return { service, findByIdUnrestricted, create };
  };

  it('asks for the recipe as that variation, not as written', async () => {
    const { service, findByIdUnrestricted } = build([entry('v-10g')]);

    await service.generate(PANTRY, 'plan-1');

    // The distractor: an implementation that drops the third argument passes a
    // test that only checks the recipe id, and then buys 1 g of yeast for a
    // loaf that needs 10.
    expect(findByIdUnrestricted).toHaveBeenCalledWith(
      'r-ciabatta',
      undefined,
      'v-10g',
    );
  });

  it('buys what the chosen variation actually needs', async () => {
    const { service } = build([entry('v-10g')]);

    const list = (await service.generate(PANTRY, 'plan-1')) as unknown as {
      items: { name: string; quantity: number }[];
    };

    expect(list.items.map((i) => `${i.quantity} ${i.name}`).sort()).toEqual([
      '10 Fresh Yeast',
      '8 Sugar',
    ]);
  });

  it('buys the recipe as written when no variation was chosen', async () => {
    const { service } = build([entry(null)]);

    const list = (await service.generate(PANTRY, 'plan-1')) as unknown as {
      items: { name: string; quantity: number }[];
    };

    expect(list.items.map((i) => `${i.quantity} ${i.name}`)).toEqual([
      '1 Fresh Yeast',
    ]);
  });
});
