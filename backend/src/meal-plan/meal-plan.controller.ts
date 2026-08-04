import { Controller, Get, Post, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service.js';
import { DeductionService } from './deduction/deduction.service.js';
import { AddMealPlanEntryDto } from './dto/add-meal-plan-entry.dto.js';
import type { MealPlan } from '../shared/interfaces/meal-plan.interface.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/** A week's plan belongs to the kitchen it will be cooked in. */
@Controller('meal-plans')
@UseGuards(SsoAuthGuard)
export class MealPlanController {
  constructor(
    private readonly mealPlanService: MealPlanService,
    private readonly deductionService: DeductionService,
    private readonly access: PantryAccessService,
  ) {}

  @Get('week')
  async getByWeek(
    @CurrentUser() user: LocalUser,
    @Query('date') date: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<MealPlan> {
    return this.mealPlanService.getOrCreateByWeek(await this.access.resolve(user, pantryId), date);
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<MealPlan> {
    return this.mealPlanService.findById(await this.access.resolve(user, pantryId), id);
  }

  @Post(':id/entries')
  async addEntry(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: AddMealPlanEntryDto,
    @Query('pantryId') pantryId?: string,
  ): Promise<MealPlan> {
    return this.mealPlanService.addEntry(await this.access.resolve(user, pantryId), id, dto);
  }

  @Delete(':id/entries/:index')
  async removeEntry(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Query('pantryId') pantryId?: string,
  ): Promise<MealPlan> {
    return this.mealPlanService.removeEntry(await this.access.resolve(user, pantryId), id, index);
  }

  @Post(':id/entries/:index/confirm')
  async confirmCooked(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Query('pantryId') pantryId?: string,
  ): Promise<void> {
    // Deducts from the pantry, so it must deduct from the RIGHT one.
    return this.deductionService.confirmCooked(await this.access.resolve(user, pantryId), id, index);
  }
}
