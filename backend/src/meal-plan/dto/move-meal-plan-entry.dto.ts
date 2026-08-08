import { IsEnum, IsString } from 'class-validator';
import { DayOfWeek, MealType } from '../../shared/enums/index.js';

/**
 * Where a planned meal should end up.
 *
 * `expectRecipeId` is not optional here, unlike the fields on a create. This
 * request MOVES an existing row addressed by position, and positions shift as a
 * household edits the plan — without it, a stale index moves whatever happens to
 * sit there now, which is somebody else's dinner.
 */
export class MoveMealPlanEntryDto {
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @IsEnum(MealType)
  meal: MealType;

  @IsString()
  expectRecipeId: string;
}
