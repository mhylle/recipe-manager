import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './shared/auth/auth.module.js';
import { PantryModule } from './pantry/pantry.module.js';
import { StaplesModule } from './staples/staples.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { RecipeModule } from './recipe/recipe.module.js';
import { MealPlanModule } from './meal-plan/meal-plan.module.js';
import { ShoppingListModule } from './shopping-list/shopping-list.module.js';
import { ImageGenerationModule } from './image-generation/image-generation.module.js';
import { BilkaToGoModule } from './bilkatogo/bilkatogo.module.js';
import { PushModule } from './push/push.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ImageGenerationModule,
    PantryModule,
    StaplesModule,
    MatchingModule,
    RecipeModule,
    MealPlanModule,
    ShoppingListModule,
    BilkaToGoModule,
    PushModule,
    ProfileModule,
    AdminModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
