import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecipeService, RecipeSearchFilters } from './recipe.service.js';
import {
  CreateRecipeRequestDto,
  UpdateRecipeRequestDto,
} from './dto/recipe-request.dto.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';
import { ReqLocale } from '../shared/i18n/req-locale.decorator.js';
import { toPagedResponse, type PagedResponse } from '../shared/pagination.js';
import {
  CurrentUser,
  MaybeCurrentUser,
} from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';
import type { RecipeTranslationInput } from './recipe.repository.js';
import { ReplaceVariationsDto } from './dto/variation.dto.js';
import type { RecipeVariationsAuthoring } from './variation-authoring.js';
import type { Locale } from '../shared/i18n/locale.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { OptionalSsoAuthGuard } from '../shared/auth/optional-sso-auth.guard.js';
import { ContributorGuard } from '../shared/auth/contributor.guard.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import { GenerateImagesDto } from './dto/generate-images.dto.js';
import { TransferRecipeDto } from './dto/transfer-recipe.dto.js';
import { MAX_IMAGE_BYTES } from './recipe-image.service.js';
import { SetLikeDto, SetStarsDto } from './dto/reaction.dto.js';
import { RecipeReactionService } from './recipe-reaction.service.js';
import type { RecipeReactionSummary } from './recipe-reaction.js';

@Controller('recipes')
export class RecipeController {
  constructor(
    private readonly recipeService: RecipeService,
    private readonly pantryAccess: PantryAccessService,
    private readonly reactions: RecipeReactionService,
  ) {}

  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Post()
  async create(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreateRecipeRequestDto,
    @ReqLocale() locale: Locale,
    @Query('pantryId') pantryId?: string,
  ): Promise<Recipe> {
    // Resolved through the membership check, never trusted from the request: a
    // caller who is not in that kitchen is refused rather than quietly filed
    // into it. With no id supplied this is their default kitchen, and someone
    // with no kitchen at all writes a recipe pinned to none.
    const kitchenId = await this.pantryAccess
      .resolve(user, pantryId)
      .catch(() => null);

    return this.recipeService.create(
      user.id,
      dto,
      locale,
      dto.translations,
      kitchenId,
    );
  }

  /**
   * The shared library, minus anything private that is not the caller's.
   *
   * Guarded optionally rather than not at all: guests must keep browsing, but
   * the read cannot filter private recipes without knowing who is asking.
   */
  @UseGuards(OptionalSsoAuthGuard)
  @Get()
  async findAll(
    @MaybeCurrentUser() user?: LocalUser,
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

    const paged = await this.recipeService.findAllFor(
      user?.id,
      filters,
      locale,
      {
        limit: limit === undefined ? undefined : Number(limit),
        offset: offset === undefined ? undefined : Number(offset),
      },
    );
    return toPagedResponse(paged);
  }

  @UseGuards(OptionalSsoAuthGuard)
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @ReqLocale() locale: Locale,
    @MaybeCurrentUser() user?: LocalUser,
    /**
     * Which way to cook it. The whole payload comes back resolved to that
     * variation, so no caller has to apply the overrides itself — and a reader
     * and a shopping list cannot end up disagreeing about what it contains.
     */
    @Query('variation') variation?: string,
  ): Promise<Recipe> {
    // A recipe the caller may not read comes back 404, not 403 — see the
    // repository. Guessing an id should not confirm that it exists.
    return this.recipeService.findByIdFor(user?.id, id, locale, variation);
  }

  /**
   * Replace a recipe's variations.
   *
   * PUT, not PATCH: the body is the whole set, so a variation the author
   * removed actually goes. A merge would leave it alive with nothing pointing
   * at it, and a meal plan could still be holding its id.
   */
  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Put(':id/variations')
  async replaceVariations(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() body: ReplaceVariationsDto,
  ): Promise<Recipe> {
    return this.recipeService.replaceVariationsFor(
      user.id,
      id,
      body.variations,
    );
  }

  /**
   * A recipe's variations as their author edits them: the differences
   * themselves, in every language, keyed by the ids they point at.
   *
   * Deliberately not the same shape `GET :id` serves. That one resolves a
   * variation into a finished recipe, which is what a cook wants and what an
   * editor cannot use — it no longer says WHICH steps a variation changes.
   */
  @UseGuards(OptionalSsoAuthGuard)
  @Get(':id/variations')
  async findVariationsForAuthoring(
    @Param('id') id: string,
    @MaybeCurrentUser() user?: LocalUser,
  ): Promise<RecipeVariationsAuthoring> {
    return this.recipeService.findVariationsForAuthoringFor(user?.id, id);
  }

  /** Every stored language for a recipe — powers the per-language editing UI. */
  @UseGuards(OptionalSsoAuthGuard)
  @Get(':id/translations')
  async findTranslations(
    @Param('id') id: string,
    @MaybeCurrentUser() user?: LocalUser,
  ): Promise<RecipeTranslationInput[]> {
    return this.recipeService.findAllTranslationsFor(user?.id, id);
  }

  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Patch(':id')
  async update(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecipeRequestDto,
    @ReqLocale() locale: Locale,
    @Query('pantryId') pantryId?: string,
  ): Promise<Recipe> {
    // Resolved the same way create does, and needed for the same reason: a
    // recipe being made private that belongs to no kitchen has to be pinned to
    // one, or only its author will ever see it again.
    const kitchenId = await this.pantryAccess
      .resolve(user, pantryId)
      .catch(() => null);

    return this.recipeService.update(
      id,
      user.id,
      dto,
      locale,
      dto.translations,
      dto.sourceLocale,
      kitchenId,
    );
  }

  /**
   * Hand a recipe to the person who actually cooked it.
   *
   * A permission change, not an edit — afterwards the previous author can no
   * longer modify or delete it — so it is its own endpoint rather than a field
   * on PATCH, where it could ride along in an ordinary save.
   */
  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Post(':id/transfer')
  async transfer(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: TransferRecipeDto,
  ): Promise<Recipe> {
    return this.recipeService.transferAuthor(id, user.id, dto.userId);
  }

  /**
   * Like a recipe, or take the like back.
   *
   * SsoAuthGuard alone, deliberately without ContributorGuard: contributing is
   * permission to change the shared library, and an opinion about someone
   * else's dish is not a change to it. Gating likes on it would leave every
   * reader with a control they are not allowed to press.
   */
  @UseGuards(SsoAuthGuard)
  @Put(':id/like')
  async setLike(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: SetLikeDto,
  ): Promise<RecipeReactionSummary> {
    return this.reactions.setLike(user.id, id, dto.liked);
  }

  /** Score a recipe out of five, or clear the score with 0. */
  @UseGuards(SsoAuthGuard)
  @Put(':id/rating')
  async setRating(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: SetStarsDto,
  ): Promise<RecipeReactionSummary> {
    return this.reactions.setStars(user.id, id, dto.stars);
  }

  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Delete(':id')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.recipeService.delete(id, user.id);
  }

  /**
   * Upload a hero image.
   *
   * Contribution-gated like every other mutation of the shared library, and
   * author-scoped inside the service. multer keeps the file in memory rather than
   * writing it to a temp path first: the service sniffs its magic bytes before
   * anything is written, so a rejected file never touches disk at all.
   */
  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async uploadImage(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Recipe> {
    if (!file) {
      throw new BadRequestException('No image was uploaded.');
    }
    return this.recipeService.uploadImage(id, user.id, {
      buffer: file.buffer,
      size: file.size,
    });
  }

  @UseGuards(SsoAuthGuard, ContributorGuard)
  @Post(':id/regenerate-images')
  async regenerateImages(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: GenerateImagesDto,
  ): Promise<{ message: string }> {
    const recipe = await this.recipeService.regenerateImages(
      id,
      user.id,
      dto.apiKey,
    );
    return { message: `Image generation started for ${recipe.name}` };
  }
}
