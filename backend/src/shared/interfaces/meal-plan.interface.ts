import { DayOfWeek } from '../enums/index.js';
import { MealType } from '../enums/index.js';

export interface MealPlanEntry {
  day: DayOfWeek;
  meal: MealType;
  recipeId: string;
  /**
   * Which way this meal is being cooked. Absent is the recipe as written.
   *
   * On the ENTRY rather than looked up later, because the shopping happens days
   * after the planning: resolving "whichever variation is first" at list time
   * would buy for a decision nobody made.
   */
  variationId?: string | null;
  servings: number;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;
  entries: MealPlanEntry[];
}
