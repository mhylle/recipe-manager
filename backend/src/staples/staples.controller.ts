import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { StaplesService } from './staples.service.js';
import { UpdateStaplesDto } from './dto/update-staples.dto.js';
import type { StaplesConfig } from '../shared/interfaces/staples-config.interface.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/** Staples are a property of a kitchen, so this follows the pantry. */
@Controller('staples')
@UseGuards(SsoAuthGuard)
export class StaplesController {
  constructor(
    private readonly staplesService: StaplesService,
    private readonly access: PantryAccessService,
  ) {}

  @Get()
  async getStaples(
    @CurrentUser() user: LocalUser,
    @Query('pantryId') pantryId?: string,
  ): Promise<StaplesConfig> {
    return this.staplesService.getStaples(
      await this.access.resolve(user, pantryId),
    );
  }

  @Put()
  async updateStaples(
    @CurrentUser() user: LocalUser,
    @Body() dto: UpdateStaplesDto,
    @Query('pantryId') pantryId?: string,
  ): Promise<StaplesConfig> {
    return this.staplesService.updateStaples(
      await this.access.resolve(user, pantryId),
      dto,
    );
  }
}
