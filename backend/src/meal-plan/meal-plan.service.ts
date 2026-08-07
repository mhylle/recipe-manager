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

  async getOrCreateByWeek(
    pantryId: string,
    weekStartDate: string,
  ): Promise<MealPlan> {
    const existing = await this.mealPlanRepository.findByWeek(
      pantryId,
      weekStartDate,
    );
    if (existing) {
      return existing;
    }
    return this.mealPlanRepository.create(pantryId, {
      weekStartDate,
      entries: [],
    });
  }

  async findById(pantryId: string, id: string): Promise<MealPlan> {
    return this.mealPlanRepository.findById(pantryId, id);
  }

  async findAll(pantryId: string): Promise<MealPlan[]> {
    return this.mealPlanRepository.findAll(pantryId);
  }

  async addEntry(
    pantryId: string,
    mealPlanId: string,
    dto: AddMealPlanEntryDto,
  ): Promise<MealPlan> {
    const entry: MealPlanEntry = {
      day: dto.day,
      meal: dto.meal,
      recipeId: dto.recipeId,
      servings: dto.servings,
    };
    return this.mealPlanRepository.addEntry(pantryId, mealPlanId, entry);
  }

  async removeEntry(
    pantryId: string,
    mealPlanId: string,
    entryIndex: number,
  ): Promise<MealPlan> {
    return this.mealPlanRepository.removeEntryByIndex(
      pantryId,
      mealPlanId,
      entryIndex,
    );
  }

  async updateEntryServings(
    pantryId: string,
    mealPlanId: string,
    entryIndex: number,
    servings: number,
  ): Promise<MealPlan> {
    const plan = await this.mealPlanRepository.findById(pantryId, mealPlanId);
    if (entryIndex < 0 || entryIndex >= plan.entries.length) {
      throw new NotFoundException(`Entry at index ${entryIndex} not found`);
    }
    plan.entries[entryIndex].servings = servings;
    return this.mealPlanRepository.update(pantryId, mealPlanId, {
      entries: plan.entries,
    });
  }
}
