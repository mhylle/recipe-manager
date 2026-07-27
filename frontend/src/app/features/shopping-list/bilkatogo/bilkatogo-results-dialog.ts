import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { BilkaToGoSendResult } from '../../../shared/models/bilkatogo.model';
import { LocaleCurrencyPipe, TranslatePipe } from '../../../shared/i18n';

@Component({
  selector: 'app-bilkatogo-results-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LocaleCurrencyPipe],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  templateUrl: './bilkatogo-results-dialog.html',
  styleUrl: './bilkatogo-results-dialog.scss',
})
export class BilkaToGoResultsDialogComponent {
  readonly result = input.required<BilkaToGoSendResult>();
  readonly closed = output<void>();

  readonly totalItems = computed(() =>
    this.result().matched.length + this.result().unmatched.length
  );
}
