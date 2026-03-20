import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service.js';
import type { ShoppingList } from '../shared/interfaces/shopping-list.interface.js';

@Controller('shopping-lists')
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Post('generate/:mealPlanId')
  async generate(
    @Param('mealPlanId') mealPlanId: string,
  ): Promise<ShoppingList> {
    return this.shoppingListService.generate(mealPlanId);
  }

  @Post('from-recipe/:recipeId')
  async generateFromRecipe(
    @Param('recipeId') recipeId: string,
    @Query('servings') servings?: string,
  ): Promise<ShoppingList> {
    const servingsNum = servings ? parseInt(servings, 10) : undefined;
    return this.shoppingListService.generateFromRecipe(recipeId, servingsNum);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ShoppingList> {
    return this.shoppingListService.findById(id);
  }

  @Patch(':id/items/:index')
  async toggleItem(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<ShoppingList> {
    return this.shoppingListService.toggleItem(id, index);
  }
}
