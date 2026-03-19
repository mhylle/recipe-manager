import { PartialType } from '@nestjs/mapped-types';
import { CreatePantryItemDto } from '../../shared/dto/create-pantry-item.dto.js';

export class UpdatePantryItemDto extends PartialType(CreatePantryItemDto) {}
