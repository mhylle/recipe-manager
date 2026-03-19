import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { Unit } from '../enums/index.js';
import { PantryCategory } from '../enums/index.js';

export class CreatePantryItemDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(Unit)
  unit: Unit;

  @IsEnum(PantryCategory)
  category: PantryCategory;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
