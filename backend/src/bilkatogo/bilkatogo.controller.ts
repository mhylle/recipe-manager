import { Controller, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import { PantryAccessService } from '../pantry/pantry-access.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';
import { BilkaToGoAuthService } from './bilkatogo-auth.service.js';
import { BilkaToGoOrchestratorService } from './bilkatogo-orchestrator.service.js';
import { BilkaToGoLoginDto } from './dto/bilkatogo-login.dto.js';
import { SendToBilkaToGoDto } from './dto/send-to-bilkatogo.dto.js';
import type { BilkaToGoSendResult } from './interfaces/bilkatogo.interfaces.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';

@Controller('bilkatogo')
@UseGuards(SsoAuthGuard)
export class BilkaToGoController {
  constructor(
    private readonly authService: BilkaToGoAuthService,
    private readonly orchestratorService: BilkaToGoOrchestratorService,
    private readonly access: PantryAccessService,
  ) {}

  @Post('login')
  async login(@Body() dto: BilkaToGoLoginDto): Promise<{ sessionId: string }> {
    const sessionId = await this.authService.login(dto.email, dto.password);
    return { sessionId };
  }

  @Post('send')
  async send(
    @CurrentUser() user: LocalUser,
    @Body() dto: SendToBilkaToGoDto,
    @Query('pantryId') pantryId?: string,
  ): Promise<BilkaToGoSendResult> {
    // The list being pushed to a real basket must belong to a kitchen this
    // caller is actually in.
    return this.orchestratorService.sendToCart(
      await this.access.resolve(user, pantryId),
      dto.shoppingListId,
      dto.sessionId,
    );
  }
}
