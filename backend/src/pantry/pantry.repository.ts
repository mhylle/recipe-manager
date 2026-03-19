import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../storage/file-storage.service.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';

@Injectable()
export class PantryRepository {
  private readonly storage: FileStorageService<PantryItem>;

  constructor() {
    this.storage = new FileStorageService<PantryItem>('pantry');
  }

  async create(
    data: Omit<PantryItem, 'id' | 'addedDate' | 'lastUpdated'>,
  ): Promise<PantryItem> {
    return this.storage.create(data as Omit<PantryItem, 'id'>);
  }

  async findAll(): Promise<PantryItem[]> {
    return this.storage.findAll();
  }

  async findById(id: string): Promise<PantryItem> {
    return this.storage.findById(id);
  }

  async update(id: string, data: Partial<PantryItem>): Promise<PantryItem> {
    return this.storage.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.storage.delete(id);
  }
}
