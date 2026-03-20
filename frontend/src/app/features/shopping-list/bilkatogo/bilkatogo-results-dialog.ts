import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BilkaToGoSendResult } from '../../../shared/models/bilkatogo.model';

@Component({
  selector: 'app-bilkatogo-results-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div
      class="dialog-backdrop"
      (click)="closed.emit()"
      role="dialog"
      aria-label="BilkaToGo results"
      aria-modal="true"
    >
      <div class="dialog card" (click)="$event.stopPropagation()">
        <h3>BilkaToGo Results</h3>
        <p class="dialog__summary">
          {{ result().matched.length }} of {{ totalItems() }} items added to your basket
        </p>

        @if (result().matched.length > 0) {
          <section class="results-section results-section--matched" aria-label="Matched items">
            <h4 class="results-section__heading">Added to basket</h4>
            <ul class="results-list" role="list">
              @for (item of result().matched; track item.product.objectID) {
                <li class="results-item">
                  <div class="results-item__info">
                    <span class="results-item__name">{{ item.product.productName }}</span>
                    @if (item.product.brand) {
                      <span class="results-item__brand">{{ item.product.brand }}</span>
                    }
                  </div>
                  <span class="results-item__price">
                    {{ item.product.price / 100 | currency:'DKK':'symbol':'1.2-2' }}
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        @if (result().unmatched.length > 0) {
          <section class="results-section results-section--unmatched" aria-label="Unmatched items">
            <h4 class="results-section__heading">Could not add</h4>
            <ul class="results-list" role="list">
              @for (item of result().unmatched; track item.itemName) {
                <li class="results-item">
                  <div class="results-item__info">
                    <span class="results-item__name">{{ item.itemName }}</span>
                    <span class="results-item__reason">{{ item.reason }}</span>
                  </div>
                </li>
              }
            </ul>
          </section>
        }

        <div class="dialog__actions">
          @if (result().cartUrl) {
            <a
              [href]="result().cartUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn--primary"
              aria-label="Open BilkaToGo basket in new tab"
            >
              Open BilkaToGo Basket
            </a>
          }
          <button type="button" class="btn btn--ghost" (click)="closed.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(45, 52, 51, 0.4);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .dialog {
      max-width: 520px;
      width: 90%;
      padding: 2rem;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: var(--shadow-elevated);
    }

    .dialog h3 {
      margin-bottom: 0.5rem;
    }

    .dialog__summary {
      color: var(--on-surface-variant);
      font-size: 0.9375rem;
      margin-bottom: 1.5rem;
    }

    .results-section {
      margin-bottom: 1.25rem;
      padding-left: 1rem;
      border-left: 3px solid;
    }

    .results-section--matched {
      border-left-color: var(--primary);
    }

    .results-section--unmatched {
      border-left-color: #d97706;
    }

    .results-section__heading {
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--on-surface-variant);
      margin-bottom: 0.75rem;
    }

    .results-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .results-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.5rem 0;
      gap: 1rem;
    }

    .results-item + .results-item {
      border-top: 1px solid var(--outline-variant);
    }

    .results-item__info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }

    .results-item__name {
      font-weight: 500;
      color: var(--on-surface);
    }

    .results-item__brand {
      font-size: 0.8125rem;
      color: var(--on-surface-variant);
    }

    .results-item__reason {
      font-size: 0.8125rem;
      color: #d97706;
    }

    .results-item__price {
      font-weight: 500;
      color: var(--on-surface);
      white-space: nowrap;
      font-size: 0.875rem;
    }

    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
  `],
})
export class BilkaToGoResultsDialogComponent {
  readonly result = input.required<BilkaToGoSendResult>();
  readonly closed = output<void>();

  readonly totalItems = computed(() =>
    this.result().matched.length + this.result().unmatched.length
  );
}
