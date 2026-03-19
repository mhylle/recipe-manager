import { Controller, Get, Put, Body } from '@nestjs/common';
import { StaplesService } from './staples.service.js';
import { UpdateStaplesDto } from './dto/update-staples.dto.js';
import type { StaplesConfig } from '../shared/interfaces/staples-config.interface.js';

@Controller('staples')
export class StaplesController {
  constructor(private readonly staplesService: StaplesService) {}

  @Get()
  async getStaples(): Promise<StaplesConfig> {
    return this.staplesService.getStaples();
  }

  @Put()
  async updateStaples(@Body() dto: UpdateStaplesDto): Promise<StaplesConfig> {
    return this.staplesService.updateStaples(dto);
  }
}
