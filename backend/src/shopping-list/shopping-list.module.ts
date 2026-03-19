import { Module } from '@nestjs/common';
import { ShoppingListController } from './shopping-list.controller.js';
import { ShoppingListService } from './shopping-list.service.js';
import { ShoppingListRepository } from './shopping-list.repository.js';
import { MealPlanModule } from '../meal-plan/meal-plan.module.js';
import { RecipeModule } from '../recipe/recipe.module.js';
import { PantryModule } from '../pantry/pantry.module.js';
import { StaplesModule } from '../staples/staples.module.js';

@Module({
  imports: [MealPlanModule, RecipeModule, PantryModule, StaplesModule],
  controllers: [ShoppingListController],
  providers: [ShoppingListService, ShoppingListRepository],
})
export class ShoppingListModule {}
