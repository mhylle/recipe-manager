import { Injectable } from '@nestjs/common';
import { RecipeRepository } from './recipe.repository.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';

export interface RecipeSearchFilters {
  tags?: string[];
  difficulty?: Difficulty;
  maxPrepTime?: number;
  maxCookTime?: number;
  query?: string;
}

@Injectable()
export class RecipeService {
  constructor(private readonly recipeRepository: RecipeRepository) {}

  async create(dto: CreateRecipeDto): Promise<Recipe> {
    return this.recipeRepository.create(dto);
  }

  async findAll(filters?: RecipeSearchFilters): Promise<Recipe[]> {
    const recipes = await this.recipeRepository.findAll();
    if (!filters) return recipes;
    return this.applyFilters(recipes, filters);
  }

  async findById(id: string): Promise<Recipe> {
    return this.recipeRepository.findById(id);
  }

  async update(id: string, dto: UpdateRecipeDto): Promise<Recipe> {
    return this.recipeRepository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.recipeRepository.delete(id);
  }

  private applyFilters(
    recipes: Recipe[],
    filters: RecipeSearchFilters,
  ): Recipe[] {
    let result = recipes;

    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }

    if (filters.difficulty) {
      result = result.filter((r) => r.difficulty === filters.difficulty);
    }

    if (filters.maxPrepTime !== undefined) {
      result = result.filter((r) => r.prepTime <= filters.maxPrepTime!);
    }

    if (filters.maxCookTime !== undefined) {
      result = result.filter((r) => r.cookTime <= filters.maxCookTime!);
    }

    if (filters.tags && filters.tags.length > 0) {
      const filterTags = filters.tags.map((t) => t.toLowerCase());
      result = result.filter((r) =>
        filterTags.every((tag) => r.tags.some((t) => t.toLowerCase() === tag)),
      );
    }

    return result;
  }
}
