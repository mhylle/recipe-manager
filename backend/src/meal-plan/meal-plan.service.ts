import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealPlanRepository } from './meal-plan.repository.js';
import {
  MealPlan,
  MealPlanEntry,
} from '../shared/interfaces/meal-plan.interface.js';
import { AddMealPlanEntryDto } from './dto/add-meal-plan-entry.dto.js';
import { MoveMealPlanEntryDto } from './dto/move-meal-plan-entry.dto.js';

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

  /**
   * Plan a recipe into a slot.
   *
   * A slot may hold more than one meal, so adding alongside is the default.
   * `dto.displace` is how a caller says "and deal with what is already there" —
   * either removing that entry or moving it somewhere else — and both happen in
   * the same repository call so a half-applied change cannot lose a meal.
   */
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
      // Captured now, while the cook is choosing. The shopping happens days
      // later and must not have to guess which version was meant.
      variationId: dto.variationId ?? null,
    };

    if (!dto.displace) {
      return this.mealPlanRepository.addEntry(pantryId, mealPlanId, entry);
    }

    const to = dto.displace.to;
    if (to && to.day === dto.day && to.meal === dto.meal) {
      // Moving the displaced meal into the slot being planned would either undo
      // the displacement or double-book it, depending on write order — and the
      // caller cannot have meant either.
      throw new BadRequestException(
        'Move the existing meal to a different slot — that is the one being planned.',
      );
    }

    return this.mealPlanRepository.addEntryDisplacing(
      pantryId,
      mealPlanId,
      entry,
      {
        index: dto.displace.index,
        expectRecipeId: dto.displace.expectRecipeId,
        to,
      },
    );
  }

  /**
   * Move a planned meal to another slot.
   *
   * Thin on purpose: the ordering, the position check and the recipe check all
   * have to happen inside one transaction, so they live in the repository rather
   * than being sequenced from here.
   */
  async moveEntry(
    pantryId: string,
    mealPlanId: string,
    entryIndex: number,
    to: MoveMealPlanEntryDto,
  ): Promise<MealPlan> {
    return this.mealPlanRepository.moveEntryByIndex(
      pantryId,
      mealPlanId,
      entryIndex,
      {
        day: to.day,
        meal: to.meal,
        expectRecipeId: to.expectRecipeId,
      },
    );
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
