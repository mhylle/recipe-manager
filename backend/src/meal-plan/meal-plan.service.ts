import { Injectable, NotFoundException } from '@nestjs/common';
import { MealPlanRepository } from './meal-plan.repository.js';
import {
  MealPlan,
  MealPlanEntry,
} from '../shared/interfaces/meal-plan.interface.js';
import { AddMealPlanEntryDto } from './dto/add-meal-plan-entry.dto.js';

@Injectable()
export class MealPlanService {
  constructor(private readonly mealPlanRepository: MealPlanRepository) {}

  async getOrCreateByWeek(weekStartDate: string): Promise<MealPlan> {
    const existing = await this.mealPlanRepository.findByWeek(weekStartDate);
    if (existing) {
      return existing;
    }
    return this.mealPlanRepository.create({ weekStartDate, entries: [] });
  }

  async findById(id: string): Promise<MealPlan> {
    return this.mealPlanRepository.findById(id);
  }

  async findAll(): Promise<MealPlan[]> {
    return this.mealPlanRepository.findAll();
  }

  async addEntry(
    mealPlanId: string,
    dto: AddMealPlanEntryDto,
  ): Promise<MealPlan> {
    const entry: MealPlanEntry = {
      day: dto.day,
      meal: dto.meal,
      recipeId: dto.recipeId,
      servings: dto.servings,
    };
    return this.mealPlanRepository.addEntry(mealPlanId, entry);
  }

  async removeEntry(mealPlanId: string, entryIndex: number): Promise<MealPlan> {
    return this.mealPlanRepository.removeEntryByIndex(mealPlanId, entryIndex);
  }

  async updateEntryServings(
    mealPlanId: string,
    entryIndex: number,
    servings: number,
  ): Promise<MealPlan> {
    const plan = await this.mealPlanRepository.findById(mealPlanId);
    if (entryIndex < 0 || entryIndex >= plan.entries.length) {
      throw new NotFoundException(`Entry at index ${entryIndex} not found`);
    }
    plan.entries[entryIndex].servings = servings;
    return this.mealPlanRepository.update(mealPlanId, {
      entries: plan.entries,
    });
  }
}
