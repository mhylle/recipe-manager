import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsOptional,
  IsUrl,
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
}
