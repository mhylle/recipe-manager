import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { PantryService } from './pantry.service.js';
import { PantryAccessService, type PantrySummary } from './pantry-access.service.js';
import {
  CreatePantryItemRequestDto,
  UpdatePantryItemRequestDto,
} from './dto/pantry-request.dto.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { ReqLocale } from '../shared/i18n/req-locale.decorator.js';
import type { PantryTranslationInput } from './pantry.repository.js';
import type { Locale } from '../shared/i18n/locale.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/**
 * Every route here is guarded, reads included.
 *
 * Pantry contents used to be readable anonymously. They cannot be any more —
 * there is no pantry without a user, and answering an unauthenticated read with
 * "some household's items" is not a sensible fallback.
 *
 * `pantryId` is accepted as a QUERY parameter and always passed through
 * PantryAccessService, which verifies membership. It is an input, never a
 * permission.
 */
@Controller('pantry')
@UseGuards(SsoAuthGuard)
export class PantryController {
  constructor(
    private readonly pantryService: PantryService,
    private readonly access: PantryAccessService,
  ) {}

  /** The kitchens this user belongs to — drives the switcher and sharing UI. */
  @Get('mine')
  async myPantries(@CurrentUser() user: LocalUser): Promise<PantrySummary[]> {
    return this.access.listForUser(user);
  }

  @Post()
  async create(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreatePantryItemRequestDto,
    @ReqLocale() locale: Locale,
    @Query('pantryId') pantryId?: string,
  ): Promise<PantryItem> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.create(scope, dto, locale, dto.translations);
  }

  @Get('expiring')
  async getExpiringItems(
    @CurrentUser() user: LocalUser,
    @Query('days') days?: string,
    @Query('pantryId') pantryId?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<PantryItem[]> {
    const scope = await this.access.resolve(user, pantryId);
    const withinDays = days ? parseInt(days, 10) : 3;
    return this.pantryService.getExpiringItems(scope, withinDays, locale);
  }

  @Get()
  async findAll(
    @CurrentUser() user: LocalUser,
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('pantryId') pantryId?: string,
    @ReqLocale() locale: Locale = 'en',
  ): Promise<PantryItem[]> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.findAll(scope, query, category, locale);
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @ReqLocale() locale: Locale,
    @Query('pantryId') pantryId?: string,
  ): Promise<PantryItem> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.findById(scope, id, locale);
  }

  /** Every stored language for an item — powers the per-language editing UI. */
  @Get(':id/translations')
  async findTranslations(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<PantryTranslationInput[]> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.findAllTranslations(scope, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Body() dto: UpdatePantryItemRequestDto,
    @ReqLocale() locale: Locale,
    @Query('pantryId') pantryId?: string,
  ): Promise<PantryItem> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.update(scope, id, dto, locale, dto.translations);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<void> {
    const scope = await this.access.resolve(user, pantryId);
    return this.pantryService.delete(scope, id);
  }
}
