import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { McpKeyService } from './mcp-key.service.js';

/** A user's own settings: for now their encrypted Gemini key. */
@Module({
  controllers: [ProfileController],
  providers: [ProfileService, McpKeyService],
  exports: [ProfileService, McpKeyService],
})
export class ProfileModule {}
