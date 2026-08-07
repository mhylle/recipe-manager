import { Injectable, Logger } from '@nestjs/common';
import { RecipeRepository } from './recipe.repository.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { ImageGenerationService } from '../image-generation/image-generation.service.js';
import { RecipeImageService } from './recipe-image.service.js';
import { ThumbnailService } from './thumbnail.service.js';
import { DEFAULT_LOCALE, Locale } from '../shared/i18n/locale.js';
import { assertCanModify } from './recipe-ownership.js';
import {
  RecipeTranslationInput,
  type RecipeSearchFilters,
} from './recipe.repository.js';
import type { PageRequest, Paged } from '../shared/pagination.js';
import { ANONYMOUS, UNRESTRICTED } from './recipe-visibility.js';
import { RecipeVisibilityService } from './recipe-visibility.service.js';

// Re-exported: callers have always imported the filter shape from the service.
export type { RecipeSearchFilters };

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly recipeRepository: RecipeRepository,
    private readonly imageGeneration: ImageGenerationService,
    private readonly recipeImages: RecipeImageService,
    private readonly thumbnails: ThumbnailService,
    private readonly visibility: RecipeVisibilityService,
  ) {}

  async create(
    createdById: string,
    dto: CreateRecipeDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: RecipeTranslationInput[],
    pantryId?: string | null,
  ): Promise<Recipe> {
    // The locale the author is writing in becomes the recipe's source locale —
    // the fallback every other language resolves to.
    const recipe = await this.recipeRepository.create(createdById, dto, {
      sourceLocale: locale,
      translations,
      // The kitchen this was written in, resolved by the controller from the
      // author's membership rather than taken from the body — a client-supplied
      // pantry id would let anyone file a recipe into someone else's kitchen.
      pantryId,
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
    // Awaited rather than fire-and-forget: the caller is about to render the
    // gallery, and a thumbnail that arrives a moment later would leave the new
    // photograph loading at full size on the very page that asked for it.
    const thumbnailUrl = await this.thumbnails.generate(imageUrl);
    return this.recipeRepository.update(id, {
      imageUrl,
      thumbnailUrl: thumbnailUrl ?? undefined,
    });
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
    // Unrestricted: the ownership check above already settled who may do this,
    // and an author regenerating images for their own private recipe must not
    // then fail to load it.
    const recipe = await this.recipeRepository.findById(
      id,
      DEFAULT_LOCALE,
      UNRESTRICTED,
    );
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
      // The gallery reads the thumbnail, so generating it here is what keeps a
      // freshly generated photograph from loading at full size in the list.
      const thumbnailUrl = await this.thumbnails.generate(heroUrl);
      await this.recipeRepository.update(recipe.id, {
        imageUrl: heroUrl,
        thumbnailUrl: thumbnailUrl ?? undefined,
      });
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

  /**
   * The library as one person sees it. `viewerId` undefined means a guest.
   *
   * Resolving the viewer here rather than in the controller keeps "who may read
   * this" in one place: a handler cannot forget the step and quietly serve the
   * anonymous list to someone who was signed in.
   */
  async findAllFor(
    viewerId: string | undefined,
    filters: RecipeSearchFilters = {},
    locale: Locale = DEFAULT_LOCALE,
    page: PageRequest = {},
  ): Promise<Paged<Recipe>> {
    // Filtering, ordering, paging and visibility all happen in SQL. A private
    // recipe dropped after the query would leave a short page and a `total`
    // that overcounts what the reader can actually open.
    return this.recipeRepository.findAll(
      filters,
      locale,
      page,
      await this.audienceFor(viewerId),
    );
  }

  async findByIdFor(
    viewerId: string | undefined,
    id: string,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Recipe> {
    return this.recipeRepository.findById(
      id,
      locale,
      await this.audienceFor(viewerId),
    );
  }

  async findAllTranslationsFor(
    viewerId: string | undefined,
    id: string,
  ): Promise<RecipeTranslationInput[]> {
    return this.recipeRepository.findAllTranslations(
      id,
      await this.audienceFor(viewerId),
    );
  }

  /**
   * A recipe resolved for machinery, with no visibility filter.
   *
   * The callers are shopping lists and pantry deduction, which resolve a recipe
   * the reader already put in their own meal plan — the kitchen check happened
   * before the entry was ever readable. Filtering here would break a private
   * recipe in the reader's own plan, which is the opposite of what privacy is
   * meant to do. Named loudly because it must never serve an HTTP read of the
   * recipe collection.
   */
  async findByIdUnrestricted(
    id: string,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Recipe> {
    return this.recipeRepository.findById(id, locale, UNRESTRICTED);
  }

  private async audienceFor(viewerId: string | undefined) {
    return (await this.visibility.forUser(viewerId)) ?? ANONYMOUS;
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
