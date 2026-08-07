import { Difficulty } from '../enums/index.js';
import { PantryCategory } from '../enums/index.js';
import { Unit } from '../enums/index.js';

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
  /** Gallery-sized WebP. Absent means the list falls back to imageUrl. */
  thumbnailUrl?: string;
  /** Who added this recipe, and the one person who can always read it back. */
  createdBy?: { id: string; displayName: string };
  /** True narrows this recipe to `pantryId`'s members. Default is the shared library. */
  isPrivate?: boolean;
  /** The kitchen a private recipe belongs to. Null once that kitchen is gone. */
  pantryId?: string | null;
}
