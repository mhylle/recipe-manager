import { Injectable } from '@nestjs/common';
import { PantryRepository } from './pantry.repository.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { PantryCategory } from '../shared/enums/index.js';

@Injectable()
export class PantryService {
  constructor(private readonly pantryRepository: PantryRepository) {}

  async create(dto: CreatePantryItemDto): Promise<PantryItem> {
    return this.pantryRepository.create(dto);
  }

  async findAll(query?: string, category?: string): Promise<PantryItem[]> {
    const items = await this.pantryRepository.findAll();
    let result = items;

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    if (category) {
      result = result.filter(
        (item) => item.category === (category as PantryCategory),
      );
    }

    return result;
  }

  async findById(id: string): Promise<PantryItem> {
    return this.pantryRepository.findById(id);
  }

  async update(id: string, dto: UpdatePantryItemDto): Promise<PantryItem> {
    return this.pantryRepository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.pantryRepository.delete(id);
  }

  async getExpiringItems(withinDays: number): Promise<PantryItem[]> {
    const items = await this.pantryRepository.findAll();
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + withinDays);

    return items.filter((item) => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      return expiry <= cutoff;
    });
  }
}
