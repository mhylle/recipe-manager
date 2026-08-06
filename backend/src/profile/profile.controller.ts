import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProfileService, type GeminiKeyState } from './profile.service.js';
import {
  McpKeyService,
  type McpKeyView,
  type McpKeyCreated,
} from '../shared/auth/mcp-key.service.js';
import { CreateMcpKeyDto } from './dto/mcp-key.dto.js';
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
  constructor(
    private readonly profile: ProfileService,
    private readonly mcpKeys: McpKeyService,
  ) {}

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

  @Get('mcp-keys')
  async listMcpKeys(@CurrentUser() user: LocalUser): Promise<McpKeyView[]> {
    return this.mcpKeys.list(user.id);
  }

  /**
   * Mint a key. The response is the ONLY time the token is returned — the client
   * must show it at once, because nothing can retrieve it again.
   */
  @Post('mcp-keys')
  async createMcpKey(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreateMcpKeyDto,
  ): Promise<McpKeyCreated> {
    return this.mcpKeys.create(user.id, dto.label);
  }

  @Delete('mcp-keys/:id')
  @HttpCode(204)
  async revokeMcpKey(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.mcpKeys.revoke(user.id, id);
  }
}
