import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../i18n';

/** The scale, as the positions a reader can point at. */
export const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Five stars, either as a control or as a read-out.
 *
 * Native radio inputs rather than buttons with `role="radio"`. The browser then
 * supplies arrow-key navigation, the roving tab stop and the announcement of
 * "3 of 5" for free — all things a hand-rolled radiogroup gets subtly wrong,
 * and none of which show up in a visual check.
 *
 * In `readonly` mode it renders no inputs at all. A disabled radio is still a
 * focus stop that says "unavailable", which is the wrong message for a gallery
 * card that is simply reporting what other people thought.
 */
@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './star-rating.html',
  styleUrl: './star-rating.scss',
})
export class StarRatingComponent {
  /** The score to show filled. Null renders an empty row of five. */
  readonly value = input<number | null>(null);
  /** A read-out rather than a control. */
  readonly readonly = input(false);
  /**
   * Distinguishes one radio group from another on the same page.
   *
   * Radios sharing a `name` are ONE group, so without this every card in a
   * gallery would fight over a single rating.
   */
  readonly groupId = input.required<string>();

  /** The score the reader picked. 0 means they cleared it. */
  readonly rated = output<number>();

  readonly stars = STAR_VALUES;

  /** Rounded to whole stars for the fill; the exact average is shown as text. */
  readonly filled = computed(() => Math.round(this.value() ?? 0));

  isFilled(star: number): boolean {
    return star <= this.filled();
  }

  onPick(star: number): void {
    this.rated.emit(star);
  }

  onClear(): void {
    this.rated.emit(0);
  }
}
