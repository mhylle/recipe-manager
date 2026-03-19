import { Module } from '@nestjs/common';
import { MealPlanController } from './meal-plan.controller.js';
import { MealPlanService } from './meal-plan.service.js';
import { MealPlanRepository } from './meal-plan.repository.js';
import { DeductionService } from './deduction/deduction.service.js';
import { PantryModule } from '../pantry/pantry.module.js';
import { RecipeModule } from '../recipe/recipe.module.js';

@Module({
  imports: [PantryModule, RecipeModule],
  controllers: [MealPlanController],
  providers: [MealPlanService, MealPlanRepository, DeductionService],
  exports: [MealPlanService, DeductionService],
})
export class MealPlanModule {}
