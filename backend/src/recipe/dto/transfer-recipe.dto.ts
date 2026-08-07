import { IsString, IsUUID } from 'class-validator';

/** Who a recipe is being handed to. */
export class TransferRecipeDto {
  /**
   * The new author's local user id.
   *
   * Validated as a uuid so a malformed value is refused at the boundary rather
   * than reaching the membership check as a string that can never match — the
   * refusal should say "that is not a user", not "you two share no kitchen".
   */
  @IsString()
  @IsUUID()
  userId: string;
}
