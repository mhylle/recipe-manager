import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Unit } from '../enums/index.js';
import { PantryCategory } from '../enums/index.js';
import { Difficulty } from '../enums/index.js';

export class RecipeIngredientDto {
  /**
   * Which existing ingredient this row IS, on a save. Absent adds one.
   *
   * Needed for the same reason `stepIds` is: variations point at ingredient
   * ids, that FK cascades on delete, and position stops identifying a row the
   * moment one is inserted or dropped. Ignored on create, where nothing exists
   * to point at yet.
   */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(Unit)
  unit: Unit;

  @IsEnum(PantryCategory)
  pantryCategory: PantryCategory;
}

export class CreateRecipeDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  servings: number;

  @IsArray()
  @IsString({ each: true })
  instructions: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructionImages?: string[];

  /**
   * Which existing step each position in `instructions` IS; null adds one.
   *
   * Needed whenever a recipe with variations changes its step COUNT. Position
   * alone stops identifying a step the moment one is inserted, and variations
   * point at step ids — so the server refuses rather than guessing, because
   * guessing moves somebody's override onto a different instruction in silence.
   */
  @IsOptional()
  @IsArray()
  stepIds?: (string | null)[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @IsNumber()
  @Min(0)
  prepTime: number;

  @IsNumber()
  @Min(0)
  cookTime: number;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /**
   * Narrow this recipe to the author's kitchen. Absent means the shared
   * library, which is what a recipe is unless someone says otherwise.
   *
   * Which kitchen is never taken from the body — the server resolves it from
   * the author's own membership, so this flag cannot be used to file a recipe
   * into a kitchen the caller does not belong to.
   */
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
