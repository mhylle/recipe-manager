import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PantryCategory, Unit } from '../../shared/enums/index.js';

/** A variation's name and reason, in one language. */
export class VariationTextDto {
  @IsString()
  locale: string;

  @IsString()
  name: string;

  /** Why you would cook it this way. Empty is allowed; absent is not. */
  @IsString()
  note: string;
}

export class VariationIngredientDto {
  /**
   * The base ingredient this changes. Absent adds one.
   *
   * The ciabatta's sugar and the teriyaki's garlic are in no base list, so
   * "adds one" is not an edge case — it is half the point.
   */
  @IsOptional()
  @IsString()
  ingredientId?: string;

  /** Drops the base ingredient. Only meaningful together with an ingredientId. */
  @IsOptional()
  @IsBoolean()
  removed?: boolean;

  /** Absent keeps the base value. An added ingredient must supply all of these. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @IsOptional()
  @IsEnum(PantryCategory)
  pantryCategory?: PantryCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** The name of an ADDED ingredient, per language. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationIngredientNameDto)
  names?: VariationIngredientNameDto[];
}

export class VariationIngredientNameDto {
  @IsString()
  locale: string;

  @IsString()
  name: string;
}

export class VariationStepTextDto {
  @IsString()
  locale: string;

  @IsString()
  text: string;
}

export class VariationStepDto {
  /**
   * The base step this replaces, BY ID.
   *
   * By id and not by position: positions shift whenever the method is edited,
   * and this project has twice shipped a bug where an index quietly addressed
   * the wrong row. Absent inserts a new step instead.
   */
  @IsOptional()
  @IsString()
  stepId?: string;

  /** Drops the base step — the marinade variation skips the quick sear. */
  @IsOptional()
  @IsBoolean()
  removed?: boolean;

  /**
   * Where an INSERTED step goes: after this many BASE steps, counted before any
   * of this variation's removals. 0 puts it first, which is where a marinade
   * belongs.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  afterPosition?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationStepTextDto)
  texts?: VariationStepTextDto[];
}

/** One way of cooking a recipe, expressed only as its differences. */
export class RecipeVariationDto {
  /**
   * Which existing variation this IS. Absent adds one.
   *
   * A meal plan entry points at a variation id, and that FK is ON DELETE SET
   * NULL — so a save that deleted and recreated the set would turn every dinner
   * already planned as "10 g yeast — same day" back into the recipe as written,
   * silently. Naming the ones being kept is what stops that.
   */
  @IsOptional()
  @IsString()
  id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationTextDto)
  texts: VariationTextDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Absent inherits the recipe's own time. */
  @IsOptional()
  @IsInt()
  @Min(0)
  prepTime?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cookTime?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationIngredientDto)
  ingredients?: VariationIngredientDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationStepDto)
  steps?: VariationStepDto[];
}

/**
 * The whole set of variations for a recipe.
 *
 * A wrapper class rather than a bare array, because a top-level array @Body has
 * no class for ValidationPipe to attach to and would arrive unvalidated — the
 * same shape as the intersection-typed @Body defect this project has already
 * had, where malformed writes reached Prisma and returned 500.
 */
export class ReplaceVariationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeVariationDto)
  variations: RecipeVariationDto[];
}
