import { Controller, Post, Body } from '@nestjs/common';
import { BilkaToGoAuthService } from './bilkatogo-auth.service.js';
import { BilkaToGoOrchestratorService } from './bilkatogo-orchestrator.service.js';
import { BilkaToGoLoginDto } from './dto/bilkatogo-login.dto.js';
import { SendToBilkaToGoDto } from './dto/send-to-bilkatogo.dto.js';
import type { BilkaToGoSendResult } from './interfaces/bilkatogo.interfaces.js';

@Controller('bilkatogo')
export class BilkaToGoController {
  constructor(
    private readonly authService: BilkaToGoAuthService,
    private readonly orchestratorService: BilkaToGoOrchestratorService,
  ) {}

  @Post('login')
  async login(@Body() dto: BilkaToGoLoginDto): Promise<{ sessionId: string }> {
    const sessionId = await this.authService.login(dto.email, dto.password);
    return { sessionId };
  }

  @Post('send')
  async send(@Body() dto: SendToBilkaToGoDto): Promise<BilkaToGoSendResult> {
    return this.orchestratorService.sendToCart(
      dto.shoppingListId,
      dto.sessionId,
    );
  }
}
