import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from '../../shared/dto/create-recipe.dto.js';

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
