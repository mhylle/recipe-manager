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

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  async create(@Body() dto: CreateRecipeDto): Promise<Recipe> {
    return this.recipeService.create(dto);
  }

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('difficulty') difficulty?: string,
    @Query('maxPrepTime') maxPrepTime?: string,
    @Query('maxCookTime') maxCookTime?: string,
    @Query('tags') tags?: string,
  ): Promise<Recipe[]> {
    const filters: RecipeSearchFilters = {};
    if (query) filters.query = query;
    if (difficulty) filters.difficulty = difficulty as Difficulty;
    if (maxPrepTime) filters.maxPrepTime = parseInt(maxPrepTime, 10);
    if (maxCookTime) filters.maxCookTime = parseInt(maxCookTime, 10);
    if (tags) filters.tags = tags.split(',').map((t) => t.trim());

    return this.recipeService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Recipe> {
    return this.recipeService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
  ): Promise<Recipe> {
    return this.recipeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.recipeService.delete(id);
  }
}
