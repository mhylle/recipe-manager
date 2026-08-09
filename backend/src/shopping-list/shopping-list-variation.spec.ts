import { ShoppingListService } from './shopping-list.service';
import { ShoppingListRepository } from './shopping-list.repository';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { RecipeService } from '../recipe/recipe.service';
import { PantryService } from '../pantry/pantry.service';
import { StaplesService } from '../staples/staples.service';
import { Unit, PantryCategory, Difficulty } from '../shared/enums/index.js';

/**
 * Buying for the way you chose to cook it.
 *
 * The meal plan already carried a variation into the shopping list. The button
 * on the RECIPE page did not, so choosing "marinated overnight with garlic and
 * soy" and pressing it shopped for the recipe as written — no garlic, and the
 * base four tablespoons of soy instead of six.
 *
 * That is the complaint #77 and #78 were filed about, surviving on the one path
 * nobody had covered. Nothing below this needed fixing: the resolver was right
 * all along, it was simply never told which variation.
 */
describe('ShoppingListService.generateFromRecipe — the variation on screen', () => {
  const PANTRY = 'p-home';
  const RECIPE = 'r-teriyaki';
  const MARINATED = 'v-marinated';

  const asWritten = {
    id: RECIPE,
    name: 'Teriyaki Salmon',
    description: '',
    servings: 4,
    instructions: [],
    prepTime: 5,
    cookTime: 15,
    difficulty: Difficulty.EASY,
    tags: [],
    ingredients: [
      {
        name: 'Soy Sauce',
        quantity: 4,
        unit: Unit.TBSP,
        pantryCategory: PantryCategory.CONDIMENTS,
      },
    ],
  };

  const marinated = {
    ...asWritten,
    variationId: MARINATED,
    ingredients: [
      {
        name: 'Soy Sauce',
        quantity: 6,
        unit: Unit.TBSP,
        pantryCategory: PantryCategory.CONDIMENTS,
      },
      {
        name: 'Garlic',
        quantity: 3,
        unit: Unit.PIECE,
        pantryCategory: PantryCategory.PRODUCE,
      },
    ],
  };

  const build = () => {
    const create = jest
      .fn()
      .mockImplementation((_pantryId: string, list: unknown) =>
        Promise.resolve({ id: 'list-1', ...(list as object) }),
      );
    // The collaborator's real contract: (id, locale, variationId). Asserting on
    // what this READS rather than on what the caller passed is the difference
    // between a test that catches the bug and one that agrees with it.
    const findByIdUnrestricted = jest
      .fn()
      .mockImplementation(
        (_id: string, _locale?: string, variationId?: string) =>
          Promise.resolve(variationId === MARINATED ? marinated : asWritten),
      );

    const service = new ShoppingListService(
      {
        create,
        archiveCurrent: jest.fn(),
      } as unknown as ShoppingListRepository,
      {} as MealPlanService,
      { findByIdUnrestricted } as unknown as RecipeService,
      { findAll: jest.fn().mockResolvedValue([]) } as unknown as PantryService,
      {
        getStaples: jest.fn().mockResolvedValue({ items: [] }),
      } as unknown as StaplesService,
    );

    return { service, create, findByIdUnrestricted };
  };

  it('resolves the recipe as the variation it was given', async () => {
    const { service, findByIdUnrestricted } = build();

    await service.generateFromRecipe(PANTRY, RECIPE, undefined, MARINATED);

    expect(findByIdUnrestricted).toHaveBeenCalledWith(
      RECIPE,
      expect.anything(),
      MARINATED,
    );
  });

  it('buys the ingredient the variation adds', async () => {
    // The whole complaint in one assertion: the garlic is in no base list, so a
    // list generated without the variation cannot contain it at all.
    const { service } = build();

    const list = await service.generateFromRecipe(
      PANTRY,
      RECIPE,
      undefined,
      MARINATED,
    );

    expect(list.items.map((i) => i.name)).toContain('Garlic');
  });

  it('buys the quantity the variation changed, not the recipe’s', async () => {
    const { service } = build();

    const list = await service.generateFromRecipe(
      PANTRY,
      RECIPE,
      undefined,
      MARINATED,
    );

    expect(list.items).toContainEqual(
      expect.objectContaining({ name: 'Soy Sauce', quantity: 6 }),
    );
  });

  it('still shops the recipe as written when no variation was chosen', async () => {
    // The distractor: an implementation that always resolved SOME variation
    // would pass everything above and quietly change what "as written" buys.
    const { service } = build();

    const list = await service.generateFromRecipe(PANTRY, RECIPE);

    expect(list.items.map((i) => i.name)).not.toContain('Garlic');
    expect(list.items).toContainEqual(
      expect.objectContaining({ name: 'Soy Sauce', quantity: 4 }),
    );
  });

  it('scales the variation’s own quantities, not the base ones', async () => {
    // Scaling and variations are applied by different code. Six tablespoons for
    // four servings is nine for six — and eight would be the base leaking in.
    const { service } = build();

    const list = await service.generateFromRecipe(PANTRY, RECIPE, 6, MARINATED);

    expect(list.items).toContainEqual(
      expect.objectContaining({ name: 'Soy Sauce', quantity: 9 }),
    );
  });
});
