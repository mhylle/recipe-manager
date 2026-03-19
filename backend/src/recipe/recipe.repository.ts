import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../storage/file-storage.service.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';

@Injectable()
export class RecipeRepository {
  private readonly storage: FileStorageService<Recipe>;

  constructor() {
    this.storage = new FileStorageService<Recipe>('recipes');
  }

  async create(data: Omit<Recipe, 'id'>): Promise<Recipe> {
    return this.storage.create(data);
  }

  async findAll(): Promise<Recipe[]> {
    return this.storage.findAll();
  }

  async findById(id: string): Promise<Recipe> {
    return this.storage.findById(id);
  }

  async update(id: string, data: Partial<Recipe>): Promise<Recipe> {
    return this.storage.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.storage.delete(id);
  }
}
