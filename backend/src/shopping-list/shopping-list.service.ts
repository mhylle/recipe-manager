import { Injectable } from '@nestjs/common';
import { ShoppingListRepository } from './shopping-list.repository.js';
import { MealPlanService } from '../meal-plan/meal-plan.service.js';
import { RecipeService } from '../recipe/recipe.service.js';
import { PantryService } from '../pantry/pantry.service.js';
import { StaplesService } from '../staples/staples.service.js';
import {
  ShoppingList,
  ShoppingListItem,
} from '../shared/interfaces/shopping-list.interface.js';
import {
  consolidateIngredients,
  ConsolidatedItem,
} from './helpers/consolidation.helper.js';

@Injectable()
export class ShoppingListService {
  constructor(
    private readonly shoppingListRepository: ShoppingListRepository,
    private readonly mealPlanService: MealPlanService,
    private readonly recipeService: RecipeService,
    private readonly pantryService: PantryService,
    private readonly staplesService: StaplesService,
  ) {}

  async generate(pantryId: string, mealPlanId: string): Promise<ShoppingList> {
    const plan = await this.mealPlanService.findById(pantryId, mealPlanId);
    const [pantryItems, staplesConfig] = await Promise.all([
      this.pantryService.findAll(pantryId),
      this.staplesService.getStaples(pantryId),
    ]);

    const stapleNames = new Set(
      staplesConfig.items.map((s) => s.toLowerCase()),
    );

    const allNeeds: ConsolidatedItem[] = [];

    for (const entry of plan.entries) {
      try {
        // The variation the entry was planned with, not the recipe as written.
        // Without this the ciabatta's 10 g loaf is shopped for as the 1 g one:
        // too little yeast, and no sugar at all, since the base has none.
        const recipe = await this.recipeService.findByIdUnrestricted(
          entry.recipeId,
          undefined,
          entry.variationId ?? undefined,
        );
        const scaleFactor = entry.servings / recipe.servings;

        for (const ingredient of recipe.ingredients) {
          if (stapleNames.has(ingredient.name.toLowerCase())) continue;

          allNeeds.push({
            name: ingredient.name,
            quantity: ingredient.quantity * scaleFactor,
            unit: ingredient.unit,
          });
        }
      } catch {
        // Recipe may have been deleted
      }
    }

    const consolidated = consolidateIngredients(allNeeds);

    const shoppingItems: ShoppingListItem[] = [];

    for (const item of consolidated) {
      const pantryItem = pantryItems.find(
        (p) => p.name.toLowerCase() === item.name.toLowerCase(),
      );

      const available = pantryItem?.quantity ?? 0;
      const needed = item.quantity - available;

      if (needed > 0) {
        shoppingItems.push({
          name: item.name,
          quantity: Math.ceil(needed * 100) / 100,
          unit: item.unit,
          checked: false,
        });
      }
    }

    // The list being replaced goes to the archive first. Without this every
    // generate leaves another unarchived list that nothing will show again, and
    // "the current list" becomes whichever one happens to be newest rather than
    // a decision anybody made.
    await this.shoppingListRepository.archiveCurrent(pantryId);

    return this.shoppingListRepository.create(pantryId, {
      mealPlanId,
      generatedDate: new Date().toISOString(),
      items: shoppingItems,
    });
  }

  async generateFromRecipe(
    pantryId: string,
    recipeId: string,
    servings?: number,
  ): Promise<ShoppingList> {
    const recipe = await this.recipeService.findByIdUnrestricted(recipeId);
    const [pantryItems, staplesConfig] = await Promise.all([
      this.pantryService.findAll(pantryId),
      this.staplesService.getStaples(pantryId),
    ]);

    const stapleNames = new Set(
      staplesConfig.items.map((s) => s.toLowerCase()),
    );

    const scaleFactor = servings ? servings / recipe.servings : 1;

    const allNeeds: ConsolidatedItem[] = [];
    for (const ingredient of recipe.ingredients) {
      if (stapleNames.has(ingredient.name.toLowerCase())) continue;
      allNeeds.push({
        name: ingredient.name,
        quantity: ingredient.quantity * scaleFactor,
        unit: ingredient.unit,
      });
    }

    const consolidated = consolidateIngredients(allNeeds);

    const shoppingItems: ShoppingListItem[] = [];
    for (const item of consolidated) {
      const pantryItem = pantryItems.find(
        (p) => p.name.toLowerCase() === item.name.toLowerCase(),
      );
      const available = pantryItem?.quantity ?? 0;
      const needed = item.quantity - available;
      if (needed > 0) {
        shoppingItems.push({
          name: item.name,
          quantity: Math.ceil(needed * 100) / 100,
          unit: item.unit,
          checked: false,
        });
      }
    }

    return this.shoppingListRepository.create(pantryId, {
      mealPlanId: `recipe:${recipeId}`,
      generatedDate: new Date().toISOString(),
      items: shoppingItems,
    });
  }

  /**
   * The list this kitchen is shopping from, if there is one.
   *
   * Null rather than a 404: having made no list yet is an ordinary state for a
   * page whose whole job is to offer making one.
   */
  async getCurrent(pantryId: string): Promise<ShoppingList | null> {
    return this.shoppingListRepository.findCurrent(pantryId);
  }

  /** Put the list away when the shopping is done. */
  async archive(pantryId: string, id: string): Promise<ShoppingList> {
    return this.shoppingListRepository.archive(pantryId, id);
  }

  async findById(pantryId: string, id: string): Promise<ShoppingList> {
    return this.shoppingListRepository.findById(pantryId, id);
  }

  async toggleItem(
    pantryId: string,
    id: string,
    itemIndex: number,
  ): Promise<ShoppingList> {
    return this.shoppingListRepository.toggleItemByIndex(
      pantryId,
      id,
      itemIndex,
    );
  }
}
