import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { RecipeService, RecipeSearchFilters } from './recipe.service.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';
import { ReqLocale } from '../shared/i18n/req-locale.decorator.js';
import type { Locale } from '../shared/i18n/locale.js';
import type { RecipeTranslationInput } from './recipe.repository.js';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  async create(
    @Body() dto: CreateRecipeDto & { translations?: RecipeTranslationInput[] },
    @ReqLocale() locale: Locale,
  ): Promise<Recipe> {
    return this.recipeService.create(dto, locale, dto.translations);
  }

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('difficulty') difficulty?: string,
    @Query('maxPrepTime') maxPrepTime?: string,
    @Query('maxCookTime') maxCookTime?: string,
    @Query('tags') tags?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<Recipe[]> {
    const filters: RecipeSearchFilters = {};
    if (query) filters.query = query;
    if (difficulty) filters.difficulty = difficulty as Difficulty;
    if (maxPrepTime) filters.maxPrepTime = parseInt(maxPrepTime, 10);
    if (maxCookTime) filters.maxCookTime = parseInt(maxCookTime, 10);
    if (tags) filters.tags = tags.split(',').map((t) => t.trim());

    return this.recipeService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined,
      locale,
    );
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @ReqLocale() locale: Locale,
  ): Promise<Recipe> {
    return this.recipeService.findById(id, locale);
  }

  /** Every stored language for a recipe — powers the per-language editing UI. */
  @Get(':id/translations')
  async findTranslations(@Param('id') id: string): Promise<RecipeTranslationInput[]> {
    return this.recipeService.findAllTranslations(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    dto: UpdateRecipeDto & {
      translations?: RecipeTranslationInput[];
      sourceLocale?: Locale;
    },
    @ReqLocale() locale: Locale,
  ): Promise<Recipe> {
    return this.recipeService.update(id, dto, locale, dto.translations, dto.sourceLocale);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.recipeService.delete(id);
  }

  @Post(':id/regenerate-images')
  async regenerateImages(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const recipe = await this.recipeService.regenerateImages(id);
    return { message: `Image generation started for ${recipe.name}` };
  }
}
