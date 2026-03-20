import { IsString, IsNotEmpty } from 'class-validator';

export class SendToBilkaToGoDto {
  @IsString()
  @IsNotEmpty()
  shoppingListId: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
