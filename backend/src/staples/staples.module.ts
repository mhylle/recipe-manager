import { Module } from '@nestjs/common';
import { PantryModule } from '../pantry/pantry.module.js';
import { StaplesController } from './staples.controller.js';
import { StaplesService } from './staples.service.js';

@Module({
  imports: [PantryModule],
  controllers: [StaplesController],
  providers: [StaplesService],
  exports: [StaplesService],
})
export class StaplesModule {}
