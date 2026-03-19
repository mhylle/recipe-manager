import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { PantryService } from './pantry.service.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';

@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Post()
  async create(@Body() dto: CreatePantryItemDto): Promise<PantryItem> {
    return this.pantryService.create(dto);
  }

  @Get('expiring')
  async getExpiringItems(@Query('days') days?: string): Promise<PantryItem[]> {
    const withinDays = days ? parseInt(days, 10) : 3;
    return this.pantryService.getExpiringItems(withinDays);
  }

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('category') category?: string,
  ): Promise<PantryItem[]> {
    return this.pantryService.findAll(query, category);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<PantryItem> {
    return this.pantryService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePantryItemDto,
  ): Promise<PantryItem> {
    return this.pantryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.pantryService.delete(id);
  }
}
