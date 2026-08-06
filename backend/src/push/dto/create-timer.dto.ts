import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/**
 * The longest timer worth booking.
 *
 * Mirrors MAX_SECONDS in the frontend's step-duration parser: nobody times a
 * dish for four days, so anything larger is a misparse rather than an
 * instruction, and it would otherwise sit in the table for a week.
 */
const MAX_TIMER_SECONDS = 24 * 60 * 60;

export class CreateTimerDto {
  /**
   * Already localised by the client. Length-capped because it goes onto a lock
   * screen and into a database row, and neither wants a pasted essay.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  body: string;

  /** Seconds from now, not an instant — see ScheduledTimerService.schedule. */
  @IsInt()
  @Min(1)
  @Max(MAX_TIMER_SECONDS)
  seconds: number;
}
