import { IsArray, IsString } from 'class-validator';

export class UpdateStaplesDto {
  @IsArray()
  @IsString({ each: true })
  items: string[];
}
