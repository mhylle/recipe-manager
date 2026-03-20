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
}
