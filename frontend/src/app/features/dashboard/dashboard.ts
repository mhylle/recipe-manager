import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService, MatchResult, AlmostCanMakeEntry } from './dashboard.service';
import { TranslatePipe } from '../../shared/i18n';
import { Inspiration, dailySeed, pickInspiration } from './inspiration';
import { RecipeService } from '../recipe/recipe.service';
import { reloadOnKitchenChange } from '../../shared/services/reload-on-kitchen-change';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly recipeService = inject(RecipeService);

  readonly matchResult = signal<MatchResult>({
    canMakeNow: [],
    almostCanMake: [],
    missingMany: [],
  });

  readonly canMakeOpen = signal(true);
  readonly almostOpen = signal(true);
  readonly missingOpen = signal(true);

  /**
   * Fixed for the day. Read once at construction rather than per render, so the
   * suggestions cannot shift under the reader mid-session.
   */
  private readonly seed = dailySeed(new Date());

  /** The three dishes in the hero, with how close the pantry is to each. */
  readonly inspiration = computed<Inspiration[]>(() =>
    pickInspiration(this.matchResult(), this.seed),
  );

  /** Ids already shown in the hero, so the lists below do not repeat them. */
  private readonly featuredIds = computed(
    () => new Set(this.inspiration().map((i) => i.recipe.id)),
  );

  /**
   * The buckets minus whatever the hero is already showing. Without this the
   * lead dish appears twice within a single screen, which reads as a bug rather
   * than as emphasis.
   */
  readonly remainingCanMake = computed(() =>
    this.matchResult().canMakeNow.filter((r) => !this.featuredIds().has(r.id)),
  );

  readonly remainingAlmost = computed(() =>
    this.matchResult().almostCanMake.filter((e) => !this.featuredIds().has(e.recipe.id)),
  );

  readonly remainingMissing = computed(() =>
    this.matchResult().missingMany.filter((r) => !this.featuredIds().has(r.id)),
  );

  /**
   * How many entries the browse ledger shows before deferring to the library.
   *
   * Not a cap on what exists — the overflow count is printed next to the link,
   * so the page never implies the list ended. Forty-six recipes you cannot cook
   * tonight is reference material, and reference material belongs behind one
   * click rather than under three screens of scroll.
   */
  private readonly BROWSE_LIMIT = 8;

  readonly browseList = computed(() => this.remainingMissing().slice(0, this.BROWSE_LIMIT));

  readonly browseOverflow = computed(() =>
    Math.max(0, this.remainingMissing().length - this.BROWSE_LIMIT),
  );

  totalTime(recipe: { prepTime: number; cookTime: number }): number {
    return recipe.prepTime + recipe.cookTime;
  }

  private readonly reload = reloadOnKitchenChange(() => this.loadMatchResults());

  /**
   * Whether this visitor has a kitchen to reason about.
   *
   * "What can I cook" reads a specific pantry. A guest has none — so instead of
   * a locked banner over an empty page, the dashboard becomes a way into the
   * recipe library, which is public. No sign-in prompt: the header carries one
   * for anyone who wants it, and nagging a browsing visitor on every page is
   * how an app feels shut rather than open.
   */
  readonly kitchenAvailable = signal(true);

  /** Re-fetch from the API. Public: the reload effect and the specs both drive it. */
  loadMatchResults(): void {
    this.dashboardService.getMatchResults().subscribe({
      next: (result) => {
        this.kitchenAvailable.set(true);
        this.matchResult.set(result);
      },
      error: () => {
        this.kitchenAvailable.set(false);
        this.loadGuestLibrary();
      },
    });
  }

  /**
   * The guest view: the public recipe library, arranged the same way.
   *
   * Everything lands in `missingMany` because without a pantry nothing is known
   * to be cookable — which makes readiness render as "unknown" rather than as a
   * misleading empty bar, and puts the whole library in the ledger.
   */
  private loadGuestLibrary(): void {
    this.recipeService.getAll().subscribe({
      next: (recipes) =>
        this.matchResult.set({ canMakeNow: [], almostCanMake: [], missingMany: recipes }),
      error: () =>
        this.matchResult.set({ canMakeNow: [], almostCanMake: [], missingMany: [] }),
    });
  }

  toggleCanMake(): void { this.canMakeOpen.update((v) => !v); }
  toggleAlmost(): void { this.almostOpen.update((v) => !v); }
  toggleMissing(): void { this.missingOpen.update((v) => !v); }

  getMissingNames(ingredients: { name: string }[]): string {
    return ingredients.map((i) => i.name).join(', ');
  }

  /** Percentage for the readiness rule. 0 when the shortfall is unknown. */
  readinessPercent(item: Inspiration): number {
    if (item.have === null || item.total === 0) {
      return 0;
    }
    return Math.round((item.have / item.total) * 100);
  }

  /** First letter, for the placeholder when a recipe has no photograph. */
  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }
}
