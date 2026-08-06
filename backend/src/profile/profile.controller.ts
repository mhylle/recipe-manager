import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProfileService, type GeminiKeyState } from './profile.service.js';
import { SaveGeminiKeyDto } from './dto/gemini-key.dto.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/**
 * A signed-in user's own settings.
 *
 * Guarded but NOT contribution-gated: managing your own API key is not writing
 * to the shared library, and someone who cannot yet add recipes may perfectly
 * well want their key stored ready for when they can.
 *
 * Every route is scoped to the caller. There is no route that reads another
 * user's key, encrypted or otherwise.
 */
@Controller('profile')
@UseGuards(SsoAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('gemini-key')
  async getGeminiKey(@CurrentUser() user: LocalUser): Promise<GeminiKeyState> {
    return this.profile.getGeminiKey(user.id);
  }

  @Put('gemini-key')
  async saveGeminiKey(
    @CurrentUser() user: LocalUser,
    @Body() dto: SaveGeminiKeyDto,
  ): Promise<GeminiKeyState> {
    return this.profile.saveGeminiKey(user.id, dto.envelope);
  }

  @Delete('gemini-key')
  @HttpCode(204)
  async deleteGeminiKey(@CurrentUser() user: LocalUser): Promise<void> {
    return this.profile.deleteGeminiKey(user.id);
  }
}
