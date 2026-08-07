import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum(['defect', 'improvement'])
  kind: 'defect' | 'improvement';

  /** Becomes the GitHub issue title, so it wants to be a one-liner. */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  /**
   * Bounded generously. Someone pasting a stack trace is exactly who this button
   * is for, so the cap is well above a paragraph and well below an essay.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description: string;

  /**
   * Where they were when they hit it, supplied by the client.
   *
   * A convenience, not evidence: it is client-controlled, so it is rendered in
   * the issue as a code span and never trusted for anything.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pagePath?: string;
}
