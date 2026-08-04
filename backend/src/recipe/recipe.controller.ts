import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { RecipeService, RecipeSearchFilters } from './recipe.service.js';
import {
  CreateRecipeRequestDto,
  UpdateRecipeRequestDto,
} from './dto/recipe-request.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';
import { ReqLocale } from '../shared/i18n/req-locale.decorator.js';
import { toPagedResponse, type PagedResponse } from '../shared/pagination.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';
import type { RecipeTranslationInput } from './recipe.repository.js';
import type { Locale } from '../shared/i18n/locale.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @UseGuards(SsoAuthGuard)
  @Post()
  async create(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreateRecipeRequestDto,
    @ReqLocale() locale: Locale,
  ): Promise<Recipe> {
    return this.recipeService.create(user.id, dto, locale, dto.translations);
  }

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('difficulty') difficulty?: string,
    @Query('maxPrepTime') maxPrepTime?: string,
    @Query('maxCookTime') maxCookTime?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<PagedResponse<Recipe>> {
    const filters: RecipeSearchFilters = {};
    if (query) filters.query = query;
    if (difficulty) filters.difficulty = difficulty as Difficulty;
    if (maxPrepTime) filters.maxPrepTime = parseInt(maxPrepTime, 10);
    if (maxCookTime) filters.maxCookTime = parseInt(maxCookTime, 10);
    if (tags) filters.tags = tags.split(',').map((t) => t.trim());

    const paged = await this.recipeService.findAll(filters, locale, {
      limit: limit === undefined ? undefined : Number(limit),
      offset: offset === undefined ? undefined : Number(offset),
    });
    return toPagedResponse(paged);
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

  @UseGuards(SsoAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeRequestDto,
    @ReqLocale() locale: Locale,
  ): Promise<Recipe> {
    return this.recipeService.update(id, dto, locale, dto.translations, dto.sourceLocale);
  }

  @UseGuards(SsoAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.recipeService.delete(id);
  }

  @UseGuards(SsoAuthGuard)
  @Post(':id/regenerate-images')
  async regenerateImages(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const recipe = await this.recipeService.regenerateImages(id);
    return { message: `Image generation started for ${recipe.name}` };
  }
}
