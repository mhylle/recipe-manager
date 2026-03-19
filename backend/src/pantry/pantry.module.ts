import { Module } from '@nestjs/common';
import { PantryController } from './pantry.controller.js';
import { PantryService } from './pantry.service.js';
import { PantryRepository } from './pantry.repository.js';

@Module({
  controllers: [PantryController],
  providers: [PantryService, PantryRepository],
  exports: [PantryService],
})
export class PantryModule {}
