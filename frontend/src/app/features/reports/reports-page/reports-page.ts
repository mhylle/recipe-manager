import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReportsService, type Report } from '../reports.service';
import { AuthService } from '../../../shared/services/auth.service';
import { LocaleDatePipe, TranslatePipe } from '../../../shared/i18n';

/**
 * What has been reported, and where it stands.
 *
 * The owner sees everything; everyone else sees their own, so a family member can
 * check that what they sent was picked up rather than wondering.
 *
 * Status comes from GitHub, which is the tracker of record — an in-app status
 * would immediately disagree with whatever is actually being worked on. When
 * GitHub cannot be reached, or a report was never mirrored, the status shows as
 * unknown rather than being guessed at.
 */
@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LocaleDatePipe],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPageComponent {
  private readonly reports = inject(ReportsService);
  readonly auth = inject(AuthService);

  readonly items = signal<Report[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  /** True while showing everyone's, false while showing only your own. */
  readonly showingAll = signal(false);

  readonly openCount = computed(
    () => this.items().filter((r) => r.githubState === 'open').length,
  );

  constructor() {
    this.auth.checkAuth();
    this.load();
  }

  /**
   * The owner's list needs a different route, and whether someone is the owner is
   * only known once /api/me has answered. Rather than sequencing that, ask for
   * everything and fall back to your own on 403 — one extra request for one
   * person, and no ordering to get wrong.
   */
  private load(): void {
    this.reports.all().subscribe({
      next: (all) => {
        this.items.set(all);
        this.showingAll.set(true);
        this.loading.set(false);
      },
      error: () => this.loadMine(),
    });
  }

  private loadMine(): void {
    this.reports.mine().subscribe({
      next: (mine) => {
        this.items.set(mine);
        this.showingAll.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /**
   * Which badge to show. Kept here so the template stays declarative.
   *
   * The return type is the literal union rather than `string` because the `t`
   * pipe is typed against the dictionary — which is what stops a typo'd key
   * reaching a template.
   */
  statusKey(
    report: Report,
  ):
    | 'reports.statusOpen'
    | 'reports.statusClosed'
    | 'reports.statusUnknown'
    | 'reports.statusNotFiled' {
    if (report.githubState === 'open') return 'reports.statusOpen';
    if (report.githubState === 'closed') return 'reports.statusClosed';
    if (report.githubIssueNumber === null) return 'reports.statusNotFiled';
    return 'reports.statusUnknown';
  }
}
