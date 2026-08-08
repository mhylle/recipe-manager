import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReportsService, type Report } from '../reports.service';
import { AuthService } from '../../../shared/services/auth.service';
import { LocaleDatePipe, TranslatePipe } from '../../../shared/i18n';
import { NgTemplateOutlet } from '@angular/common';

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
  imports: [TranslatePipe, LocaleDatePipe, NgTemplateOutlet],
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

  /** Still outstanding — being worked on is emphatically not finished. */
  readonly openCount = computed(
    () =>
      this.items().filter(
        (r) => r.githubState === 'open' || r.githubState === 'in_progress',
      ).length,
  );

  /**
   * The list is read to answer "what is still outstanding", so it is ordered by
   * how alive each report is rather than by when it arrived: picked up, then
   * open, then whatever GitHub could not tell us about, then done.
   *
   * Newest first within a rank, sorted here rather than inherited from the API's
   * `orderBy`. Taking the order from someone else's default means it changes
   * without this view saying so.
   */
  readonly ordered = computed(() =>
    [...this.items()].sort(
      (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt),
    ),
  );

  readonly ideas = computed(() =>
    this.ordered().filter((r) => r.kind === 'improvement'),
  );

  readonly defects = computed(() =>
    this.ordered().filter((r) => r.kind === 'defect'),
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
    | 'reports.statusInProgress'
    | 'reports.statusClosed'
    | 'reports.statusUnknown'
    | 'reports.statusNotFiled' {
    if (report.githubState === 'in_progress') return 'reports.statusInProgress';
    if (report.githubState === 'open') return 'reports.statusOpen';
    if (report.githubState === 'closed') return 'reports.statusClosed';
    if (report.githubIssueNumber === null) return 'reports.statusNotFiled';
    return 'reports.statusUnknown';
  }
}

/** Lower sorts first: alive at the top, finished at the bottom. */
function rank(report: Report): number {
  if (report.githubState === 'in_progress') return 0;
  if (report.githubState === 'open') return 1;
  if (report.githubState === 'closed') return 3;
  // Unknown and never-filed sit above closed: neither is evidence of being done.
  return 2;
}
