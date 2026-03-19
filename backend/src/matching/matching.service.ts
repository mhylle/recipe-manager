import { Injectable } from '@nestjs/common';
import { PantryService } from '../pantry/pantry.service.js';
import { RecipeService } from '../recipe/recipe.service.js';
import { StaplesService } from '../staples/staples.service.js';
import {
  Recipe,
  RecipeIngredient,
} from '../shared/interfaces/recipe.interface.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { getExpiryStatus } from '../pantry/helpers/expiry.helper.js';

export interface MissingIngredient {
  name: string;
  required: number;
  available: number;
  unit: string;
}

export interface AlmostCanMakeEntry {
  recipe: Recipe;
  missingIngredients: MissingIngredient[];
  usesExpiringIngredients?: boolean;
}

export interface MatchResult {
  canMakeNow: Recipe[];
  almostCanMake: AlmostCanMakeEntry[];
  missingMany: Recipe[];
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly pantryService: PantryService,
    private readonly recipeService: RecipeService,
    private readonly staplesService: StaplesService,
  ) {}

  async matchRecipes(servingsOverride?: number): Promise<MatchResult> {
    const [recipes, pantryItems, staplesConfig] = await Promise.all([
      this.recipeService.findAll(),
      this.pantryService.findAll(),
      this.staplesService.getStaples(),
    ]);

    const stapleNames = new Set(
      staplesConfig.items.map((s) => s.toLowerCase()),
    );

    const result: MatchResult = {
      canMakeNow: [],
      almostCanMake: [],
      missingMany: [],
    };

    for (const recipe of recipes) {
      const missingIngredients = this.findMissingIngredients(
        recipe,
        pantryItems,
        stapleNames,
        servingsOverride,
      );

      if (missingIngredients.length === 0) {
        result.canMakeNow.push(recipe);
      } else if (missingIngredients.length <= 2) {
        const usesExpiring = this.recipeUsesExpiringIngredients(
          recipe,
          pantryItems,
          stapleNames,
        );
        result.almostCanMake.push({
          recipe,
          missingIngredients,
          usesExpiringIngredients: usesExpiring,
        });
      } else {
        result.missingMany.push(recipe);
      }
    }

    // Sort canMakeNow: recipes using expiring ingredients first
    result.canMakeNow.sort((a, b) => {
      const aExpiring = this.recipeUsesExpiringIngredients(
        a,
        pantryItems,
        stapleNames,
      );
      const bExpiring = this.recipeUsesExpiringIngredients(
        b,
        pantryItems,
        stapleNames,
      );
      if (aExpiring && !bExpiring) return -1;
      if (!aExpiring && bExpiring) return 1;
      return 0;
    });

    // Sort almostCanMake: recipes using expiring ingredients first
    result.almostCanMake.sort((a, b) => {
      if (a.usesExpiringIngredients && !b.usesExpiringIngredients) return -1;
      if (!a.usesExpiringIngredients && b.usesExpiringIngredients) return 1;
      return 0;
    });

    return result;
  }

  private recipeUsesExpiringIngredients(
    recipe: Recipe,
    pantryItems: PantryItem[],
    stapleNames: Set<string>,
  ): boolean {
    for (const ingredient of recipe.ingredients) {
      if (stapleNames.has(ingredient.name.toLowerCase())) {
        continue;
      }
      const pantryItem = this.findPantryMatch(ingredient, pantryItems);
      if (pantryItem?.expiryDate) {
        const status = getExpiryStatus(pantryItem.expiryDate);
        if (status === 'expiring-soon' || status === 'expired') {
          return true;
        }
      }
    }
    return false;
  }

  private findMissingIngredients(
    recipe: Recipe,
    pantryItems: PantryItem[],
    stapleNames: Set<string>,
    servingsOverride?: number,
  ): MissingIngredient[] {
    const missing: MissingIngredient[] = [];
    const scaleFactor = servingsOverride
      ? servingsOverride / recipe.servings
      : 1;

    for (const ingredient of recipe.ingredients) {
      if (this.isStapleIngredient(ingredient, stapleNames)) {
        continue;
      }

      const requiredQty = ingredient.quantity * scaleFactor;
      const pantryItem = this.findPantryMatch(ingredient, pantryItems);

      if (!pantryItem || pantryItem.quantity < requiredQty) {
        missing.push({
          name: ingredient.name,
          required: requiredQty,
          available: pantryItem?.quantity ?? 0,
          unit: ingredient.unit,
        });
      }
    }

    return missing;
  }

  private isStapleIngredient(
    ingredient: RecipeIngredient,
    stapleNames: Set<string>,
  ): boolean {
    return stapleNames.has(ingredient.name.toLowerCase());
  }

  private findPantryMatch(
    ingredient: RecipeIngredient,
    pantryItems: PantryItem[],
  ): PantryItem | undefined {
    return pantryItems.find(
      (item) =>
        item.name.toLowerCase() === ingredient.name.toLowerCase() &&
        item.category === ingredient.pantryCategory,
    );
  }
}
