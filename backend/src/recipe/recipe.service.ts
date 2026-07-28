import { Injectable, Logger } from '@nestjs/common';
import { RecipeRepository } from './recipe.repository.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';
import { ImageGenerationService } from '../image-generation/image-generation.service.js';
import { DEFAULT_LOCALE, Locale } from '../shared/i18n/locale.js';
import {
  RecipeTranslationInput,
  type RecipeSearchFilters,
} from './recipe.repository.js';
import type { PageRequest, Paged } from '../shared/pagination.js';

// Re-exported: callers have always imported the filter shape from the service.
export type { RecipeSearchFilters };


@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly recipeRepository: RecipeRepository,
    private readonly imageGeneration: ImageGenerationService,
  ) {}

  async create(
    dto: CreateRecipeDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: RecipeTranslationInput[],
  ): Promise<Recipe> {
    // The locale the author is writing in becomes the recipe's source locale —
    // the fallback every other language resolves to.
    const recipe = await this.recipeRepository.create(dto, { sourceLocale: locale, translations });
    // Fire-and-forget image generation
    if (this.imageGeneration.isEnabled() && !recipe.imageUrl) {
      this.generateImagesAsync(recipe).catch((err) =>
        this.logger.error(
          `Image generation failed for ${recipe.name}: ${err}`,
        ),
      );
    }
    return recipe;
  }

  async regenerateImages(id: string): Promise<Recipe> {
    const recipe = await this.recipeRepository.findById(id);
    // Fire-and-forget — returns immediately
    this.generateImagesAsync(recipe).catch((err) =>
      this.logger.error(
        `Image regeneration failed for ${recipe.name}: ${err}`,
      ),
    );
    return recipe;
  }

  private async generateImagesAsync(recipe: Recipe): Promise<void> {
    const heroUrl = await this.imageGeneration.generateHeroImage(recipe);
    if (heroUrl) {
      await this.recipeRepository.update(recipe.id, { imageUrl: heroUrl });
    }

    const stepImages =
      await this.imageGeneration.generateStepImages(recipe);
    if (stepImages.length > 0) {
      await this.recipeRepository.update(recipe.id, {
        instructionImages: stepImages,
      });
    }
  }

  async findAll(
    filters: RecipeSearchFilters = {},
    locale: Locale = DEFAULT_LOCALE,
    page: PageRequest = {},
  ): Promise<Paged<Recipe>> {
    // Filtering, ordering and paging all happen in SQL. The text query still
    // matches what the reader sees — the repository resolves that per locale.
    return this.recipeRepository.findAll(filters, locale, page);
  }

  async findById(id: string, locale: Locale = DEFAULT_LOCALE): Promise<Recipe> {
    return this.recipeRepository.findById(id, locale);
  }

  async findAllTranslations(id: string): Promise<RecipeTranslationInput[]> {
    return this.recipeRepository.findAllTranslations(id);
  }

  async update(
    id: string,
    dto: UpdateRecipeDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: RecipeTranslationInput[],
    sourceLocale?: Locale,
  ): Promise<Recipe> {
    return this.recipeRepository.update(id, dto, { locale, translations, sourceLocale });
  }

  async delete(id: string): Promise<void> {
    return this.recipeRepository.delete(id);
  }

}
