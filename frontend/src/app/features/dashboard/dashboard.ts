import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, MatchResult, AlmostCanMakeEntry } from './dashboard.service';
import { TranslatePipe, reloadOnLocaleChange } from '../../shared/i18n';
import { Inspiration, dailySeed, pickInspiration } from './inspiration';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, NgOptimizedImage],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);

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

  totalTime(recipe: { prepTime: number; cookTime: number }): number {
    return recipe.prepTime + recipe.cookTime;
  }

  private readonly reload = reloadOnLocaleChange(() => this.loadMatchResults());

  /** Re-fetch from the API. Public: the locale effect and the specs both drive it. */
  loadMatchResults(): void {
    this.dashboardService.getMatchResults().subscribe((result) => {
      this.matchResult.set(result);
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
