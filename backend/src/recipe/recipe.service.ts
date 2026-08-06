import { Injectable, Logger } from '@nestjs/common';
import { RecipeRepository } from './recipe.repository.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { ImageGenerationService } from '../image-generation/image-generation.service.js';
import { RecipeImageService } from './recipe-image.service.js';
import { DEFAULT_LOCALE, Locale } from '../shared/i18n/locale.js';
import { assertCanModify } from './recipe-ownership.js';
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
    private readonly recipeImages: RecipeImageService,
  ) {}

  async create(
    createdById: string,
    dto: CreateRecipeDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: RecipeTranslationInput[],
  ): Promise<Recipe> {
    // The locale the author is writing in becomes the recipe's source locale —
    // the fallback every other language resolves to.
    const recipe = await this.recipeRepository.create(createdById, dto, {
      sourceLocale: locale,
      translations,
    });
    // Deliberately does NOT generate images.
    //
    // Generation needs the author's own Gemini key, and a create request is not
    // where that belongs — the recipe should save whether or not they have one.
    // It became an explicit action instead: the detail page offers it, and a
    // cook with no key uploads their own photographs.
    return recipe;
  }

  /**
   * Replace a recipe's hero image with one the author uploaded.
   *
   * The path that needs no API key from anybody — which is what makes removing
   * the shared Gemini key liveable for a cook with no Gemini account.
   */
  async uploadImage(
    id: string,
    callerId: string,
    file: { buffer: Buffer; size: number },
  ): Promise<Recipe> {
    // Replacing the picture is a modification, same as regenerating it.
    assertCanModify(await this.recipeRepository.findOwner(id), callerId);
    const imageUrl = this.recipeImages.store(id, file);
    return this.recipeRepository.update(id, { imageUrl });
  }

  /**
   * Generate photography for a recipe using the caller's own Gemini key.
   *
   * The key arrives per request and is never stored server-side in plaintext —
   * see ImageGenerationService. It is passed down rather than held anywhere, so
   * the work of one user's generation cannot spend another user's quota.
   */
  async regenerateImages(
    id: string,
    callerId: string,
    apiKey: string,
  ): Promise<Recipe> {
    // Regenerating replaces someone's photographs, so it is a modification.
    assertCanModify(await this.recipeRepository.findOwner(id), callerId);
    const recipe = await this.recipeRepository.findById(id);
    // Fire-and-forget — returns immediately
    this.generateImagesAsync(recipe, apiKey).catch((err) =>
      this.logger.error(`Image regeneration failed for ${recipe.name}: ${err}`),
    );
    return recipe;
  }

  private async generateImagesAsync(
    recipe: Recipe,
    apiKey: string,
  ): Promise<void> {
    const heroUrl = await this.imageGeneration.generateHeroImage(
      recipe,
      apiKey,
    );
    if (heroUrl) {
      await this.recipeRepository.update(recipe.id, { imageUrl: heroUrl });
    }

    const stepImages = await this.imageGeneration.generateStepImages(
      recipe,
      apiKey,
    );
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
    callerId: string,
    dto: UpdateRecipeDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: RecipeTranslationInput[],
    sourceLocale?: Locale,
  ): Promise<Recipe> {
    assertCanModify(await this.recipeRepository.findOwner(id), callerId);
    return this.recipeRepository.update(id, dto, {
      locale,
      translations,
      sourceLocale,
    });
  }

  async delete(id: string, callerId: string): Promise<void> {
    assertCanModify(await this.recipeRepository.findOwner(id), callerId);
    return this.recipeRepository.delete(id);
  }
}
