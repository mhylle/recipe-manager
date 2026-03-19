import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../storage/file-storage.service.js';
import { MealPlan } from '../shared/interfaces/meal-plan.interface.js';

@Injectable()
export class MealPlanRepository {
  private readonly storage: FileStorageService<MealPlan>;

  constructor() {
    this.storage = new FileStorageService<MealPlan>('meal-plans');
  }

  async create(data: Omit<MealPlan, 'id'>): Promise<MealPlan> {
    return this.storage.create(data);
  }

  async findAll(): Promise<MealPlan[]> {
    return this.storage.findAll();
  }

  async findById(id: string): Promise<MealPlan> {
    return this.storage.findById(id);
  }

  async update(id: string, data: Partial<MealPlan>): Promise<MealPlan> {
    return this.storage.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.storage.delete(id);
  }
}
