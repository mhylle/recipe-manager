import { Module } from '@nestjs/common';
import { StaplesController } from './staples.controller.js';
import { StaplesService } from './staples.service.js';

@Module({
  controllers: [StaplesController],
  providers: [StaplesService],
  exports: [StaplesService],
})
export class StaplesModule {}
