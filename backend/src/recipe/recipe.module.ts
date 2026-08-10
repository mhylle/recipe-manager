import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller.js';
import { RecipeService } from './recipe.service.js';
import { RecipeRepository } from './recipe.repository.js';
import { RecipeImageService } from './recipe-image.service.js';
import { ThumbnailService } from './thumbnail.service.js';
import { ThumbnailBackfillService } from './thumbnail-backfill.service.js';
import { RecipeVisibilityService } from './recipe-visibility.service.js';
import { RecipeReactionService } from './recipe-reaction.service.js';
import { PantryModule } from '../pantry/pantry.module.js';

@Module({
  // For PantryAccessService: creating a recipe pins it to the author's kitchen,
  // and only the membership check can say which kitchen that legitimately is.
  imports: [PantryModule],
  controllers: [RecipeController],
  providers: [
    RecipeService,
    RecipeRepository,
    RecipeImageService,
    ThumbnailService,
    ThumbnailBackfillService,
    RecipeVisibilityService,
    RecipeReactionService,
  ],
  exports: [RecipeService],
})
export class RecipeModule {}
