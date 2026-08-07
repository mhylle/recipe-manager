import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MatchingService, MatchResult } from './matching.service.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/**
 * "What can I cook?" answers from a specific kitchen's contents, so it is
 * pantry-scoped and therefore authenticated — unlike the recipe library itself.
 */
@Controller('recipes/match')
@UseGuards(SsoAuthGuard)
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly access: PantryAccessService,
  ) {}

  @Get()
  async matchRecipes(
    @CurrentUser() user: LocalUser,
    @Query('servings') servings?: string,
    @Query('pantryId') pantryId?: string,
  ): Promise<MatchResult> {
    const servingsNum = servings ? parseInt(servings, 10) : undefined;
    return this.matchingService.matchRecipes(
      user.id,
      await this.access.resolve(user, pantryId),
      servingsNum,
    );
  }
}
