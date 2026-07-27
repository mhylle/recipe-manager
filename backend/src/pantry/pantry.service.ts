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
    dto: CreatePantryItemDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: PantryTranslationInput[],
  ): Promise<PantryItem> {
    return this.pantryRepository.create(dto, { sourceLocale: locale, translations });
  }

  async findAll(
    query?: string,
    category?: string,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<PantryItem[]> {
    // Search AFTER localisation so a Danish query matches Danish names.
    const items = await this.pantryRepository.findAll(locale);
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

  async findById(id: string, locale: Locale = DEFAULT_LOCALE): Promise<PantryItem> {
    return this.pantryRepository.findById(id, locale);
  }

  async findAllTranslations(id: string): Promise<PantryTranslationInput[]> {
    return this.pantryRepository.findAllTranslations(id);
  }

  async update(
    id: string,
    dto: UpdatePantryItemDto,
    locale: Locale = DEFAULT_LOCALE,
    translations?: PantryTranslationInput[],
  ): Promise<PantryItem> {
    return this.pantryRepository.update(id, dto, { locale, translations });
  }

  async delete(id: string): Promise<void> {
    return this.pantryRepository.delete(id);
  }

  async getExpiringItems(
    withinDays: number,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<PantryItem[]> {
    const items = await this.pantryRepository.findAll(locale);
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
