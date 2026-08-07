import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReportsService, type Report, type ReportKind } from '../../../features/reports/reports.service';
import { TranslatePipe } from '../../i18n';

type ReportError =
  | 'report.errRequired'
  | 'report.errTooMany'
  | 'report.errFailed'
  | 'report.errSignedOut';

/**
 * Report a fault or a wish, from wherever you are.
 *
 * The point is that reporting costs nothing, so nothing here blocks on the
 * mirror: the backend saves the report first and mirrors it to GitHub after, and
 * the response says which happened. A report that did not reach GitHub is still a
 * report, and telling someone it failed would be a lie that also loses their
 * words.
 */
@Component({
  selector: 'app-report-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.scss',
})
export class ReportDialogComponent {
  private readonly reports = inject(ReportsService);
  private readonly router = inject(Router);

  readonly dismissed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly titleRef = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  readonly busy = signal(false);
  readonly errorKey = signal<ReportError | null>(null);
  /** The saved report, so the confirmation can link to the issue. */
  readonly sent = signal<Report | null>(null);

  kind: ReportKind = 'defect';
  title = '';
  description = '';

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
        queueMicrotask(() => this.titleRef()?.nativeElement.focus());
      }
    });
  }

  submit(): void {
    if (this.busy()) return;
    if (!this.title.trim() || !this.description.trim()) {
      this.errorKey.set('report.errRequired');
      return;
    }

    this.busy.set(true);
    this.errorKey.set(null);

    this.reports
      .send({
        kind: this.kind,
        title: this.title.trim(),
        description: this.description.trim(),
        // Where they were. Saves a round trip of "where did you see this?".
        pagePath: this.router.url,
      })
      .subscribe({
        next: (report) => {
          this.busy.set(false);
          this.sent.set(report);
        },
        error: (err: { status?: number }) => {
          this.busy.set(false);
          if (err.status === 401) {
            this.errorKey.set('report.errSignedOut');
          } else if (err.status === 429) {
            // A rate limit reported as a failure sends someone retyping a
            // perfectly good report.
            this.errorKey.set('report.errTooMany');
          } else {
            this.errorKey.set('report.errFailed');
          }
        },
      });
  }

  close(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog?.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
    this.dismissed.emit();
  }
}
