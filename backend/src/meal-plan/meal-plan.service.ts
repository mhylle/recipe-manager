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
    const all = await this.mealPlanRepository.findAll();
    const existing = all.find((mp) => mp.weekStartDate === weekStartDate);
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
    const plan = await this.mealPlanRepository.findById(mealPlanId);
    const entry: MealPlanEntry = {
      day: dto.day,
      meal: dto.meal,
      recipeId: dto.recipeId,
      servings: dto.servings,
    };
    plan.entries.push(entry);
    return this.mealPlanRepository.update(mealPlanId, {
      entries: plan.entries,
    });
  }

  async removeEntry(mealPlanId: string, entryIndex: number): Promise<MealPlan> {
    const plan = await this.mealPlanRepository.findById(mealPlanId);
    if (entryIndex < 0 || entryIndex >= plan.entries.length) {
      throw new NotFoundException(`Entry at index ${entryIndex} not found`);
    }
    plan.entries.splice(entryIndex, 1);
    return this.mealPlanRepository.update(mealPlanId, {
      entries: plan.entries,
    });
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
