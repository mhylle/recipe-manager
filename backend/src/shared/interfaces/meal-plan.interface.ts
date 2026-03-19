import { DayOfWeek } from '../enums/index.js';
import { MealType } from '../enums/index.js';

export interface MealPlanEntry {
  day: DayOfWeek;
  meal: MealType;
  recipeId: string;
  servings: number;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;
  entries: MealPlanEntry[];
}
