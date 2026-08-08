/** A variation as offered to a reader: enough to choose between them. */
export interface RecipeVariationSummary {
  id: string;
  name: string;
  /** Why you would cook it this way. */
  note: string;
}

import { Difficulty } from '../enums/difficulty.enum';
import { PantryCategory } from '../enums/pantry-category.enum';
import { Unit } from '../enums/unit.enum';

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  instructions: string[];
  instructionImages?: string[];
  ingredients: RecipeIngredient[];
  prepTime: number;
  cookTime: number;
  difficulty: Difficulty;
  tags: string[];
  imageUrl?: string;
  /** Gallery-sized WebP. Absent means fall back to imageUrl. */
  thumbnailUrl?: string;
  /** The other ways this recipe can be cooked. Absent means there are none. */
  variations?: RecipeVariationSummary[];
  /**
   * Which variation everything above has been resolved to.
   *
   * The server resolves it, so nothing here applies overrides itself — a page
   * and a shopping list cannot end up disagreeing about what it contains.
   */
  variationId?: string;
  /** Who added it, and the one person who can always read it back. */
  createdBy?: { id: string; displayName: string };
  /** True means only the author's kitchen sees it. Absent reads as false. */
  isPrivate?: boolean;
}
