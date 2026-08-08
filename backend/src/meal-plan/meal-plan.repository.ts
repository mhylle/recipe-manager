import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MealPlan,
  MealPlanEntry,
} from '../shared/interfaces/meal-plan.interface.js';
import type { DayOfWeek, MealType } from '../shared/enums/index.js';

@Injectable()
export class MealPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    pantryId: string,
    data: Omit<MealPlan, 'id'>,
  ): Promise<MealPlan> {
    const result = await this.prisma.mealPlan.create({
      data: {
        pantryId,
        weekStartDate: data.weekStartDate,
        entries: {
          create: data.entries.map((entry) => ({
            day: entry.day,
            meal: entry.meal,
            servings: entry.servings,
            recipeId: entry.recipeId,
          })),
        },
      },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    return this.toInterface(result);
  }

  async findAll(pantryId: string): Promise<MealPlan[]> {
    const results = await this.prisma.mealPlan.findMany({
      where: { pantryId },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    return results.map((r) => this.toInterface(r));
  }

  async findById(pantryId: string, id: string): Promise<MealPlan> {
    // Scoped: a plan id from another household is a miss, not a read.
    const result = await this.prisma.mealPlan.findFirst({
      where: { id, pantryId },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!result) {
      throw new NotFoundException(`meal-plans with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  async findByWeek(
    pantryId: string,
    weekStartDate: string,
  ): Promise<MealPlan | null> {
    // The week is unique PER PANTRY now, so the lookup needs both.
    const result = await this.prisma.mealPlan.findUnique({
      where: { pantryId_weekStartDate: { pantryId, weekStartDate } },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    return result ? this.toInterface(result) : null;
  }

  async addEntry(
    pantryId: string,
    mealPlanId: string,
    entry: MealPlanEntry,
  ): Promise<MealPlan> {
    // Resolve the plan inside the pantry FIRST. Without this, a plan id from
    // another household would happily accept entries.
    await this.findById(pantryId, mealPlanId);
    await this.prisma.mealPlanEntry.create({
      data: {
        day: entry.day,
        meal: entry.meal,
        servings: entry.servings,
        recipeId: entry.recipeId,
        mealPlanId,
      },
    });
    return this.findById(pantryId, mealPlanId);
  }

  /**
   * Add an entry while removing or moving one that is already there.
   *
   * Both halves run in one transaction. Sequenced as two requests instead, a
   * failure after the delete leaves the plan short a meal the cook never asked
   * to lose — and there is no undo for that in the UI.
   *
   * The index is resolved inside the transaction and checked against the recipe
   * the caller expected to find. Indices are positional, so a household member
   * editing the plan at the same time shifts them; without the check a stale
   * index deletes whatever moved into that position instead.
   */
  async addEntryDisplacing(
    pantryId: string,
    mealPlanId: string,
    entry: MealPlanEntry,
    displace: {
      index: number;
      expectRecipeId: string;
      to?: { day: DayOfWeek; meal: MealType };
    },
  ): Promise<MealPlan> {
    // Same pantry guard as addEntry: a plan id from another household must not
    // be writable, and it is checked before the transaction does any work.
    await this.findById(pantryId, mealPlanId);

    await this.prisma.$transaction(async (tx) => {
      const entries = await tx.mealPlanEntry.findMany({
        where: { mealPlanId },
        orderBy: { createdAt: 'asc' },
      });

      const existing = entries[displace.index];
      if (!existing) {
        throw new NotFoundException(
          `Entry at index ${displace.index} not found`,
        );
      }
      if (existing.recipeId !== displace.expectRecipeId) {
        throw new ConflictException(
          'That meal has changed since you loaded the plan. Reload and try again.',
        );
      }

      if (displace.to) {
        await tx.mealPlanEntry.update({
          where: { id: existing.id },
          data: { day: displace.to.day, meal: displace.to.meal },
        });
      } else {
        await tx.mealPlanEntry.delete({ where: { id: existing.id } });
      }

      await tx.mealPlanEntry.create({
        data: {
          day: entry.day,
          meal: entry.meal,
          servings: entry.servings,
          recipeId: entry.recipeId,
          mealPlanId,
        },
      });
    });

    return this.findById(pantryId, mealPlanId);
  }

  /**
   * Move a planned meal to another slot.
   *
   * Its own operation rather than a displacement: "cook it on Wednesday
   * instead" deletes nothing, and routing it through addEntryDisplacing would
   * recreate the row for no reason.
   *
   * The row is UPDATED, so the entry keeps its position in the plan. Every other
   * route addresses entries positionally, and a move that renumbered them would
   * silently change what a delete already in flight points at.
   *
   * Same stale-index guard as displacement, and for the same reason: positions
   * shift as a household edits the plan, so the caller says which recipe it
   * believed was there and the server checks inside the transaction.
   */
  async moveEntryByIndex(
    pantryId: string,
    mealPlanId: string,
    index: number,
    to: { day: DayOfWeek; meal: MealType; expectRecipeId: string },
  ): Promise<MealPlan> {
    await this.findById(pantryId, mealPlanId);

    await this.prisma.$transaction(async (tx) => {
      const entries = await tx.mealPlanEntry.findMany({
        where: { mealPlanId },
        orderBy: { createdAt: 'asc' },
      });

      const existing = entries[index];
      if (!existing) {
        throw new NotFoundException(`Entry at index ${index} not found`);
      }
      if (existing.recipeId !== to.expectRecipeId) {
        throw new ConflictException(
          'That meal has changed since you loaded the plan. Reload and try again.',
        );
      }

      await tx.mealPlanEntry.update({
        where: { id: existing.id },
        data: { day: to.day, meal: to.meal },
      });
    });

    return this.findById(pantryId, mealPlanId);
  }

  async removeEntryByIndex(
    pantryId: string,
    mealPlanId: string,
    index: number,
  ): Promise<MealPlan> {
    await this.findById(pantryId, mealPlanId);
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { mealPlanId },
      orderBy: { createdAt: 'asc' },
    });
    if (index < 0 || index >= entries.length) {
      throw new NotFoundException(`Entry at index ${index} not found`);
    }
    await this.prisma.mealPlanEntry.delete({
      where: { id: entries[index].id },
    });
    return this.findById(pantryId, mealPlanId);
  }

  async getEntryByIndex(pantryId: string, mealPlanId: string, index: number) {
    await this.findById(pantryId, mealPlanId);
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { mealPlanId },
      orderBy: { createdAt: 'asc' },
    });
    if (index < 0 || index >= entries.length) {
      return null;
    }
    return entries[index];
  }

  async update(
    pantryId: string,
    id: string,
    data: Partial<MealPlan>,
  ): Promise<MealPlan> {
    await this.findById(pantryId, id);
    if (data.weekStartDate !== undefined) {
      await this.prisma.mealPlan.update({
        where: { id },
        data: { weekStartDate: data.weekStartDate },
      });
    }
    return this.findById(pantryId, id);
  }

  async delete(pantryId: string, id: string): Promise<void> {
    await this.findById(pantryId, id);
    await this.prisma.mealPlan.delete({ where: { id } });
  }

  private toInterface(result: Record<string, unknown>): MealPlan {
    const r = result as {
      id: string;
      weekStartDate: string;
      entries: Array<{
        day: string;
        meal: string;
        recipeId: string;
        servings: number;
      }>;
    };
    return {
      id: r.id,
      weekStartDate: r.weekStartDate,
      entries: r.entries.map((e) => ({
        day: e.day as MealPlanEntry['day'],
        meal: e.meal as MealPlanEntry['meal'],
        recipeId: e.recipeId,
        servings: e.servings,
      })),
    };
  }
}
