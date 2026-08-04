import { Controller, Get, Post, Patch, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service.js';
import type { ShoppingList } from '../shared/interfaces/shopping-list.interface.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/** Shopping lists are generated from a kitchen's pantry and staples. */
@Controller('shopping-lists')
@UseGuards(SsoAuthGuard)
export class ShoppingListController {
  constructor(
    private readonly shoppingListService: ShoppingListService,
    private readonly access: PantryAccessService,
  ) {}

  @Post('generate/:mealPlanId')
  async generate(
    @CurrentUser() user: LocalUser,
    @Param('mealPlanId') mealPlanId: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<ShoppingList> {
    return this.shoppingListService.generate(await this.access.resolve(user, pantryId), mealPlanId);
  }

  @Post('from-recipe/:recipeId')
  async generateFromRecipe(
    @CurrentUser() user: LocalUser,
    @Param('recipeId') recipeId: string,
    @Query('servings') servings?: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<ShoppingList> {
    const servingsNum = servings ? parseInt(servings, 10) : undefined;
    return this.shoppingListService.generateFromRecipe(
      await this.access.resolve(user, pantryId),
      recipeId,
      servingsNum,
    );
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<ShoppingList> {
    return this.shoppingListService.findById(await this.access.resolve(user, pantryId), id);
  }

  @Patch(':id/items/:index')
  async toggleItem(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Query('pantryId') pantryId?: string,
  ): Promise<ShoppingList> {
    return this.shoppingListService.toggleItem(await this.access.resolve(user, pantryId), id, index);
  }
}
