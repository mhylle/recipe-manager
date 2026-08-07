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
