import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MealPlanService } from './meal-plan.service.js';
import { DeductionService } from './deduction/deduction.service.js';
import { AddMealPlanEntryDto } from './dto/add-meal-plan-entry.dto.js';
import type { MealPlan } from '../shared/interfaces/meal-plan.interface.js';

@Controller('meal-plans')
export class MealPlanController {
  constructor(
    private readonly mealPlanService: MealPlanService,
    private readonly deductionService: DeductionService,
  ) {}

  @Get('week')
  async getByWeek(@Query('date') date: string): Promise<MealPlan> {
    return this.mealPlanService.getOrCreateByWeek(date);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<MealPlan> {
    return this.mealPlanService.findById(id);
  }

  @Post(':id/entries')
  async addEntry(
    @Param('id') id: string,
    @Body() dto: AddMealPlanEntryDto,
  ): Promise<MealPlan> {
    return this.mealPlanService.addEntry(id, dto);
  }

  @Delete(':id/entries/:index')
  async removeEntry(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<MealPlan> {
    return this.mealPlanService.removeEntry(id, index);
  }

  @Post(':id/entries/:index/confirm')
  async confirmCooked(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<void> {
    return this.deductionService.confirmCooked(id, index);
  }
}
