import { Injectable } from '@nestjs/common';
import { MealPlanService } from '../meal-plan.service.js';
import { RecipeService } from '../../recipe/recipe.service.js';
import { PantryService } from '../../pantry/pantry.service.js';
import { PantryItem } from '../../shared/interfaces/pantry-item.interface.js';

export interface EffectivePantryItem extends PantryItem {
  effectiveQuantity: number;
}

@Injectable()
export class DeductionService {
  constructor(
    private readonly mealPlanService: MealPlanService,
    private readonly recipeService: RecipeService,
    private readonly pantryService: PantryService,
  ) {}

  async getEffectivePantry(): Promise<EffectivePantryItem[]> {
    const [pantryItems, mealPlans] = await Promise.all([
      this.pantryService.findAll(),
      this.mealPlanService.findAll(),
    ]);

    // Build deduction map: key = "name|category", value = total reserved quantity
    const deductions = new Map<string, number>();

    for (const plan of mealPlans) {
      for (const entry of plan.entries) {
        try {
          const recipe = await this.recipeService.findById(entry.recipeId);
          const scaleFactor = entry.servings / recipe.servings;

          for (const ingredient of recipe.ingredients) {
            const key = `${ingredient.name.toLowerCase()}|${ingredient.pantryCategory}`;
            const reserved = ingredient.quantity * scaleFactor;
            deductions.set(key, (deductions.get(key) ?? 0) + reserved);
          }
        } catch {
          // Recipe may have been deleted, skip
        }
      }
    }

    return pantryItems.map((item) => {
      const key = `${item.name.toLowerCase()}|${item.category}`;
      const reserved = deductions.get(key) ?? 0;
      const effectiveQuantity = Math.max(0, item.quantity - reserved);
      return { ...item, effectiveQuantity };
    });
  }

  async confirmCooked(mealPlanId: string, entryIndex: number): Promise<void> {
    const plan = await this.mealPlanService.findById(mealPlanId);
    const entry = plan.entries[entryIndex];
    if (!entry) return;

    try {
      const recipe = await this.recipeService.findById(entry.recipeId);
      const scaleFactor = entry.servings / recipe.servings;

      // Deduct from pantry
      const pantryItems = await this.pantryService.findAll();
      for (const ingredient of recipe.ingredients) {
        const pantryItem = pantryItems.find(
          (item) =>
            item.name.toLowerCase() === ingredient.name.toLowerCase() &&
            item.category === ingredient.pantryCategory,
        );
        if (pantryItem) {
          const deductQty = ingredient.quantity * scaleFactor;
          const newQty = Math.max(0, pantryItem.quantity - deductQty);
          await this.pantryService.update(pantryItem.id, { quantity: newQty });
        }
      }
    } catch {
      // Recipe may have been deleted
    }

    // Remove the entry from the meal plan
    await this.mealPlanService.removeEntry(mealPlanId, entryIndex);
  }
}
