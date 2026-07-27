import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService, MatchResult, AlmostCanMakeEntry } from './dashboard.service';
import { TranslatePipe, reloadOnLocaleChange } from '../../shared/i18n';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
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
}
