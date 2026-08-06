import { IsOptional, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from '../../shared/dto/create-recipe.dto.js';
import { RecipeTranslationDto } from '../../shared/dto/translation-input.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../shared/i18n/locale.js';

/**
 * What POST/PATCH /recipes actually accept.
 *
 * Named classes, not `CreateRecipeDto & { translations?: … }` — an intersection
 * erases to `Object` in the emitted metadata and ValidationPipe then skips the
 * parameter altogether. See translation-input.dto.ts.
 */
export class CreateRecipeRequestDto extends CreateRecipeDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeTranslationDto)
  translations?: RecipeTranslationDto[];

  /**
   * Language the flat text fields are written in. Checked here so a bad value
   * is named at the boundary; the service validates it again for callers that
   * do not come through this DTO.
   */
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  sourceLocale?: Locale;
}

export class UpdateRecipeRequestDto extends PartialType(
  CreateRecipeRequestDto,
) {}
