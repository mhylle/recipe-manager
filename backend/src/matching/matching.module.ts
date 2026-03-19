import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';
import { PantryModule } from '../pantry/pantry.module.js';
import { RecipeModule } from '../recipe/recipe.module.js';
import { StaplesModule } from '../staples/staples.module.js';

@Module({
  imports: [PantryModule, RecipeModule, StaplesModule],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
