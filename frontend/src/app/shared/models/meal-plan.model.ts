import { DayOfWeek } from '../enums/day-of-week.enum';
import { MealType } from '../enums/meal-type.enum';

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
