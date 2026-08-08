import { Difficulty } from '../enums/index.js';
import { PantryCategory } from '../enums/index.js';
import { Unit } from '../enums/index.js';

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
}

/** A variation as offered to a reader: enough to choose between them. */
export interface RecipeVariationSummary {
  id: string;
  name: string;
  /** Why you would cook it this way. */
  note: string;
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
  /** Gallery-sized WebP. Absent means the list falls back to imageUrl. */
  thumbnailUrl?: string;
  /** Who added this recipe, and the one person who can always read it back. */
  createdBy?: { id: string; displayName: string };
  /** True narrows this recipe to `pantryId`'s members. Default is the shared library. */
  isPrivate?: boolean;
  /** The kitchen a private recipe belongs to. Null once that kitchen is gone. */
  pantryId?: string | null;
  /** The other ways this recipe can be cooked. Absent means there are none. */
  variations?: RecipeVariationSummary[];
  /**
   * Which variation the rest of this payload has been resolved to.
   *
   * Absent means the recipe as written. Present means every field above already
   * reflects that variation — callers apply nothing themselves, so a reader and
   * a shopping list cannot disagree about what "the 10 g version" contains.
   */
  variationId?: string;
}
