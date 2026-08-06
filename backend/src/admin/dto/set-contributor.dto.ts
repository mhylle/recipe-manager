import { IsBoolean } from 'class-validator';

export class SetContributorDto {
  /** True to allow adding to the shared library, false to withdraw. */
  @IsBoolean()
  granted: boolean;
}
