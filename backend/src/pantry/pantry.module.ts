import { Module } from '@nestjs/common';
import { PantryController } from './pantry.controller.js';
import { PantryService } from './pantry.service.js';
import { PantryRepository } from './pantry.repository.js';
import { PantryAccessService } from './pantry-access.service.js';
import { PantrySharingController } from './pantry-sharing.controller.js';

@Module({
  controllers: [PantryController, PantrySharingController],
  providers: [PantryService, PantryRepository, PantryAccessService],
  exports: [PantryService, PantryAccessService],
})
export class PantryModule {}
