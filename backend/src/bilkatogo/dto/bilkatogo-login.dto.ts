import { IsString, IsNotEmpty } from 'class-validator';

export class BilkaToGoLoginDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
