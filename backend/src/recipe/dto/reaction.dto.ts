import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { MAX_STARS } from '../recipe-reaction.js';

/** Liking a recipe, or taking the like back. */
export class SetLikeDto {
  /**
   * Sent explicitly rather than toggled server-side.
   *
   * A toggle makes the result depend on state the client cannot see, so two
   * taps racing each other settle on whichever arrived last instead of on what
   * the cook actually wanted. Stating the target is idempotent.
   */
  @IsBoolean()
  liked: boolean;
}

/** Scoring a recipe out of five. */
export class SetStarsDto {
  /**
   * 1-5, or 0 to clear the score.
   *
   * The floor is 0 and not 1 because a cook must be able to take a rating back,
   * and deleting the row would take their like with it. `normaliseStars` turns
   * the 0 into a stored NULL; validation here only keeps the scale honest.
   */
  @IsInt()
  @Min(0)
  @Max(MAX_STARS)
  stars: number;
}
