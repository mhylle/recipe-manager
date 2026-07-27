import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { PantryService } from './pantry.service.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { ReqLocale } from '../shared/i18n/req-locale.decorator.js';
import type { Locale } from '../shared/i18n/locale.js';
import type { PantryTranslationInput } from './pantry.repository.js';

@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Post()
  async create(
    @Body() dto: CreatePantryItemDto & { translations?: PantryTranslationInput[] },
    @ReqLocale() locale: Locale,
  ): Promise<PantryItem> {
    return this.pantryService.create(dto, locale, dto.translations);
  }

  @Get('expiring')
  async getExpiringItems(
    @Query('days') days?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<PantryItem[]> {
    const withinDays = days ? parseInt(days, 10) : 3;
    return this.pantryService.getExpiringItems(withinDays, locale);
  }

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<PantryItem[]> {
    return this.pantryService.findAll(query, category, locale);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @ReqLocale() locale: Locale,
  ): Promise<PantryItem> {
    return this.pantryService.findById(id, locale);
  }

  /** Every stored language for an item — powers the per-language editing UI. */
  @Get(':id/translations')
  async findTranslations(@Param('id') id: string): Promise<PantryTranslationInput[]> {
    return this.pantryService.findAllTranslations(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePantryItemDto & { translations?: PantryTranslationInput[] },
    @ReqLocale() locale: Locale,
  ): Promise<PantryItem> {
    return this.pantryService.update(id, dto, locale, dto.translations);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.pantryService.delete(id);
  }
}
