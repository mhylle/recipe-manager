import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RecipeService } from '../../../features/recipe/recipe.service';
import { AuthService } from '../../services/auth.service';
import { LocaleService, TranslatePipe, bcp47Of } from '../../i18n';
import { NO_REACTIONS, type RecipeReactionSummary } from '../../models/recipe.model';
import { StarRatingComponent } from '../star-rating/star-rating';

/**
 * The heart and the stars for one recipe.
 *
 * Optimistic: the new state is shown the instant it is tapped and rolled back
 * if the request fails. A rating that waits for a round trip before moving
 * reads as a control that did not work, and the retry is a second vote.
 *
 * Signed-out readers see the totals and no controls. Ratings are attributed to
 * a person — an anonymous ballot would be one browser away from being stuffed —
 * so there is nothing useful to offer a guest here beyond what everyone thought.
 */
@Component({
  selector: 'app-recipe-reactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, StarRatingComponent],
  templateUrl: './recipe-reactions.html',
  styleUrl: './recipe-reactions.scss',
})
export class RecipeReactionsComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  readonly recipeId = input.required<string>();
  /** What the server last said. Absent on a recipe nobody has reacted to. */
  readonly reactions = input<RecipeReactionSummary | undefined>(undefined);

  /** The totals after a change, so the page holding the recipe can update it. */
  readonly changed = output<RecipeReactionSummary>();

  /** What is on screen: the server's answer until the reader changes something. */
  private readonly pending = signal<RecipeReactionSummary | null>(null);

  readonly current = computed(
    () => this.pending() ?? this.reactions() ?? NO_REACTIONS,
  );

  readonly canReact = computed(() => this.auth.isAuthenticated());

  readonly likeCount = computed(() => this.current().likeCount);
  readonly likedByMe = computed(() => this.current().likedByMe);
  readonly myStars = computed(() => this.current().myStars);
  readonly ratingCount = computed(() => this.current().ratingCount);

  /**
   * The average as text, in the reader's language.
   *
   * Danish writes 4,2 where English writes 4.2. Formatting it by hand would put
   * an English decimal point in front of every Danish reader.
   */
  readonly averageLabel = computed(() => {
    const average = this.current().ratingAverage;
    if (average === null) {
      return null;
    }
    return new Intl.NumberFormat(bcp47Of(this.locale.locale()), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(average);
  });

  toggleLike(): void {
    const before = this.current();
    const liked = !before.likedByMe;

    // Moved first, corrected later. The count follows the reader's own vote so
    // the number beside the heart cannot disagree with the heart itself.
    this.pending.set({
      ...before,
      likedByMe: liked,
      likeCount: before.likeCount + (liked ? 1 : -1),
    });

    this.recipeService.setLike(this.recipeId(), liked).subscribe({
      next: (summary) => this.settle(summary),
      error: () => this.pending.set(before),
    });
  }

  rate(stars: number): void {
    const before = this.current();
    const value = stars === 0 ? null : stars;

    // The average is left alone until the server answers. Recomputing it here
    // would need everyone else's scores, which this component does not have —
    // and a guessed average that then jumps is worse than one that waits.
    this.pending.set({ ...before, myStars: value });

    this.recipeService.setRating(this.recipeId(), stars).subscribe({
      next: (summary) => this.settle(summary),
      error: () => this.pending.set(before),
    });
  }

  private settle(summary: RecipeReactionSummary): void {
    this.pending.set(summary);
    this.changed.emit(summary);
  }
}
