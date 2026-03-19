import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../storage/file-storage.service.js';
import { ShoppingList } from '../shared/interfaces/shopping-list.interface.js';

@Injectable()
export class ShoppingListRepository {
  private readonly storage: FileStorageService<ShoppingList>;

  constructor() {
    this.storage = new FileStorageService<ShoppingList>('shopping-lists');
  }

  async create(data: Omit<ShoppingList, 'id'>): Promise<ShoppingList> {
    return this.storage.create(data);
  }

  async findById(id: string): Promise<ShoppingList> {
    return this.storage.findById(id);
  }

  async update(id: string, data: Partial<ShoppingList>): Promise<ShoppingList> {
    return this.storage.update(id, data);
  }

  async findAll(): Promise<ShoppingList[]> {
    return this.storage.findAll();
  }
}
