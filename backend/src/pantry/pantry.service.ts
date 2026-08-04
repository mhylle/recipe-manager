import { Injectable } from '@nestjs/common';
import { PantryRepository } from './pantry.repository.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { PantryCategory } from '../shared/enums/index.js';
import { DEFAULT_LOCALE, Locale } from '../shared/i18n/locale.js';
import { PantryTranslationInput } from './pantry.repository.js';

@Injectable()
export class PantryService {
  constructor(private readonly pantryRepository: PantryRepository) {}

  async create(
    pantryId: string,
    dto: CreatePantryItemDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: PantryTranslationInput[],
  ): Promise<PantryItem> {
    return this.pantryRepository.create(pantryId, dto, { sourceLocale: locale, translations });
  }

  async findAll(
    pantryId: string,
    query?: string,
    category?: string,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<PantryItem[]> {
    // Search AFTER localisation so a Danish query matches Danish names.
    const items = await this.pantryRepository.findAll(pantryId, locale);
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

  async findById(pantryId: string, id: string, locale: Locale = DEFAULT_LOCALE): Promise<PantryItem> {
    return this.pantryRepository.findById(pantryId, id, locale);
  }

  async findAllTranslations(pantryId: string, id: string): Promise<PantryTranslationInput[]> {
    return this.pantryRepository.findAllTranslations(pantryId, id);
  }

  async update(
    pantryId: string,
    id: string,
    dto: UpdatePantryItemDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: PantryTranslationInput[],
  ): Promise<PantryItem> {
    return this.pantryRepository.update(pantryId, id, dto, { locale, translations });
  }

  async delete(pantryId: string, id: string): Promise<void> {
    return this.pantryRepository.delete(pantryId, id);
  }

  async getExpiringItems(
    pantryId: string,
    withinDays: number,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<PantryItem[]> {
    const items = await this.pantryRepository.findAll(pantryId, locale);
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
