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
  /** Who added it, and the one person who can always read it back. */
  createdBy?: { id: string; displayName: string };
  /** True means only the author's kitchen sees it. Absent reads as false. */
  isPrivate?: boolean;
}
