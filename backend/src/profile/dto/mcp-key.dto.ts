import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMcpKeyDto {
  /**
   * The user's own words for which machine this is — "work laptop", "Claude
   * Desktop". The only way to tell two keys apart later, since neither token is
   * ever shown again.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;
}
