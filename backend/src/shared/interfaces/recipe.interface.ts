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
}
