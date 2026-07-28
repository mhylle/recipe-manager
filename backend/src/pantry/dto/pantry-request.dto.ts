import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { CreatePantryItemDto } from '../../shared/dto/create-pantry-item.dto.js';
import { PantryTranslationDto } from '../../shared/dto/translation-input.dto.js';

/**
 * What POST /pantry actually accepts.
 *
 * Named classes, not `CreatePantryItemDto & { translations?: … }` — an
 * intersection erases to `Object` in the emitted metadata and ValidationPipe
 * then skips the parameter altogether. See translation-input.dto.ts.
 */
export class CreatePantryItemRequestDto extends CreatePantryItemDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PantryTranslationDto)
  translations?: PantryTranslationDto[];
}

export class UpdatePantryItemRequestDto extends PartialType(CreatePantryItemRequestDto) {}
