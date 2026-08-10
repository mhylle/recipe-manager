import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LocaleService, TranslatePipe, bcp47Of } from '../../i18n';
import { NO_REACTIONS, type RecipeReactionSummary } from '../../models/recipe.model';
import { StarRatingComponent } from '../star-rating/star-rating';

/**
 * What everyone thought, small enough for a card.
 *
 * A read-out and nothing more. The list renders dozens of these, and making
 * each one a live control would put a service injection and a click target
 * behind every card — including on the gallery, where the whole card is already
 * a link to the recipe and a nested button inside it is a swallowed tap.
 */
@Component({
  selector: 'app-recipe-score',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, StarRatingComponent],
  templateUrl: './recipe-score.html',
  styleUrl: './recipe-score.scss',
})
export class RecipeScoreComponent {
  private readonly locale = inject(LocaleService);

  readonly reactions = input<RecipeReactionSummary | undefined>(undefined);
  /** Only to keep the star row's ids distinct between cards. */
  readonly recipeId = input.required<string>();

  readonly current = computed(() => this.reactions() ?? NO_REACTIONS);

  /** Nothing to say about a recipe nobody has touched — the row stays out. */
  readonly hasAnything = computed(
    () => this.current().ratingCount > 0 || this.current().likeCount > 0,
  );

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
}
