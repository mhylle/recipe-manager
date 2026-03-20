import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PantryModule } from './pantry/pantry.module.js';
import { StaplesModule } from './staples/staples.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { RecipeModule } from './recipe/recipe.module.js';
import { MealPlanModule } from './meal-plan/meal-plan.module.js';
import { ShoppingListModule } from './shopping-list/shopping-list.module.js';
import { ImageGenerationModule } from './image-generation/image-generation.module.js';
import { BilkaToGoModule } from './bilkatogo/bilkatogo.module.js';

@Module({
  imports: [
    PrismaModule,
    ImageGenerationModule,
    PantryModule,
    StaplesModule,
    MatchingModule,
    RecipeModule,
    MealPlanModule,
    ShoppingListModule,
    BilkaToGoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
