import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller.js';
import { RecipeService } from './recipe.service.js';
import { RecipeRepository } from './recipe.repository.js';
import { RecipeImageService } from './recipe-image.service.js';
import { ThumbnailService } from './thumbnail.service.js';
import { ThumbnailBackfillService } from './thumbnail-backfill.service.js';

@Module({
  controllers: [RecipeController],
  providers: [
    RecipeService,
    RecipeRepository,
    RecipeImageService,
    ThumbnailService,
    ThumbnailBackfillService,
  ],
  exports: [RecipeService],
})
export class RecipeModule {}
