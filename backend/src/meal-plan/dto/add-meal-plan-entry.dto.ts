import {
  IsString,
  IsNumber,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '../../shared/enums/index.js';
import { MealType } from '../../shared/enums/index.js';

/** Where a displaced entry should end up. */
export class DisplaceToDto {
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @IsEnum(MealType)
  meal: MealType;
}

/**
 * What to do with an entry already sitting in the slot being planned.
 *
 * Optional throughout, because a slot holding more than one meal is allowed —
 * a big lunch and a small one on the same day is a real thing to plan. Adding
 * alongside stays the default, and displacing is something the caller has to
 * ask for explicitly.
 */
export class DisplaceDto {
  /**
   * Which existing entry to displace, by its position in the plan — the same
   * index the delete and confirm routes take.
   */
  @IsInt()
  @Min(0)
  index: number;

  /**
   * The recipe the caller believes is at that index.
   *
   * Indices shift as a household edits the plan, and this operation DELETES or
   * moves a row. Without this guard, a stale index quietly displaces whatever
   * happens to be there now — someone else's dinner. The server compares before
   * touching anything and refuses on a mismatch.
   */
  @IsString()
  expectRecipeId: string;

  /**
   * Absent means remove the displaced entry. Present means move it there
   * instead, which is what keeps a recipe someone still wants to cook.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplaceToDto)
  to?: DisplaceToDto;
}

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

  /**
   * Deal with what is already in the slot, in the same request.
   *
   * One call rather than the client sequencing a delete and an add: between two
   * calls a failed second half leaves the plan missing a meal the cook never
   * asked to lose.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplaceDto)
  displace?: DisplaceDto;
}
