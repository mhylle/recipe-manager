import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MealPlan, MealPlanEntry } from '../shared/interfaces/meal-plan.interface.js';

@Injectable()
export class MealPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Omit<MealPlan, 'id'>): Promise<MealPlan> {
    const result = await this.prisma.mealPlan.create({
      data: {
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

  async findAll(): Promise<MealPlan[]> {
    const results = await this.prisma.mealPlan.findMany({
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    return results.map((r) => this.toInterface(r));
  }

  async findById(id: string): Promise<MealPlan> {
    const result = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!result) {
      throw new NotFoundException(`meal-plans with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  async findByWeek(weekStartDate: string): Promise<MealPlan | null> {
    const result = await this.prisma.mealPlan.findUnique({
      where: { weekStartDate },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    return result ? this.toInterface(result) : null;
  }

  async addEntry(mealPlanId: string, entry: MealPlanEntry): Promise<MealPlan> {
    await this.prisma.mealPlanEntry.create({
      data: {
        day: entry.day,
        meal: entry.meal,
        servings: entry.servings,
        recipeId: entry.recipeId,
        mealPlanId,
      },
    });
    return this.findById(mealPlanId);
  }

  async removeEntryByIndex(mealPlanId: string, index: number): Promise<MealPlan> {
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
    return this.findById(mealPlanId);
  }

  async getEntryByIndex(mealPlanId: string, index: number) {
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { mealPlanId },
      orderBy: { createdAt: 'asc' },
    });
    if (index < 0 || index >= entries.length) {
      return null;
    }
    return entries[index];
  }

  async update(id: string, data: Partial<MealPlan>): Promise<MealPlan> {
    await this.findById(id);
    if (data.weekStartDate !== undefined) {
      await this.prisma.mealPlan.update({
        where: { id },
        data: { weekStartDate: data.weekStartDate },
      });
    }
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
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
