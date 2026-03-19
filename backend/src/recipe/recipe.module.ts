import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller.js';
import { RecipeService } from './recipe.service.js';
import { RecipeRepository } from './recipe.repository.js';

@Module({
  controllers: [RecipeController],
  providers: [RecipeService, RecipeRepository],
  exports: [RecipeService],
})
export class RecipeModule {}
