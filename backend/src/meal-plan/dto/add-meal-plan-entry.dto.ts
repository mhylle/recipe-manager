import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { DayOfWeek } from '../../shared/enums/index.js';
import { MealType } from '../../shared/enums/index.js';

export class AddMealPlanEntryDto {
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @IsEnum(MealType)
  meal: MealType;

  @IsString()
  recipeId: string;

  @IsNumber()
  @Min(1)
  servings: number;
}
