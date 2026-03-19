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

  async generate(mealPlanId: string): Promise<ShoppingList> {
    const plan = await this.mealPlanService.findById(mealPlanId);
    const [pantryItems, staplesConfig] = await Promise.all([
      this.pantryService.findAll(),
      this.staplesService.getStaples(),
    ]);

    const stapleNames = new Set(
      staplesConfig.items.map((s) => s.toLowerCase()),
    );

    const allNeeds: ConsolidatedItem[] = [];

    for (const entry of plan.entries) {
      try {
        const recipe = await this.recipeService.findById(entry.recipeId);
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

    return this.shoppingListRepository.create({
      mealPlanId,
      generatedDate: new Date().toISOString(),
      items: shoppingItems,
    });
  }

  async findById(id: string): Promise<ShoppingList> {
    return this.shoppingListRepository.findById(id);
  }

  async toggleItem(id: string, itemIndex: number): Promise<ShoppingList> {
    return this.shoppingListRepository.toggleItemByIndex(id, itemIndex);
  }
}
