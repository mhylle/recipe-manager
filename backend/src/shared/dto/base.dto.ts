import { IsOptional, IsString } from 'class-validator';

export class BaseDto {
  @IsOptional()
  @IsString()
  id?: string;
}
