import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { StaplesService } from '../staples.service';

@Component({
  selector: 'app-staples-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="staples-page">
      <div class="staples-page__header">
        <h1>Kitchen Essentials</h1>
        <p class="staples-page__subtitle">Define the essential ingredients that always have a home in your pantry.</p>
      </div>

      <div class="staples-page__grid">
        <!-- Left: Add New Essential -->
        <div class="card staples-page__add-card">
          <h3>Add New Essential</h3>
          <div class="staples-page__add-form">
            <label for="newStaple" class="sr-only">New staple name</label>
            <input
              id="newStaple"
              type="text"
              class="input"
              [formControl]="newStapleControl"
              placeholder="e.g. Olive Oil, Sea Salt..."
              (keydown.enter)="addStaple()"
              aria-label="New staple name"
            />
            <button
              type="button"
              class="btn btn--primary"
              (click)="addStaple()"
              [disabled]="newStapleControl.invalid"
            >
              Add
            </button>
          </div>
        </div>

        <!-- Right: Your Essentials -->
        <div class="card staples-page__list-card">
          <div class="staples-page__list-header">
            <h3>Your Essentials</h3>
            <span class="label-text">{{ items().length }} items</span>
          </div>

          @if (items().length === 0) {
            <p class="staples-page__empty" role="status">
              No staples configured. Add items you always have on hand.
            </p>
          } @else {
            <ul class="staples-page__list" role="list">
              @for (item of items(); track item) {
                <li class="staples-page__item">
                  <span class="staples-page__item-name">{{ item }}</span>
                  <button
                    type="button"
                    class="btn btn--text"
                    (click)="removeStaple(item)"
                    [attr.aria-label]="'Remove ' + item"
                  >
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .staples-page__header {
      margin-bottom: 2rem;
    }

    .staples-page__header h1 {
      margin-bottom: 0.25rem;
    }

    .staples-page__subtitle {
      color: var(--on-surface-variant);
      font-size: 1rem;
    }

    .staples-page__grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 2rem;
    }

    .staples-page__add-card h3 {
      margin-bottom: 1rem;
    }

    .staples-page__add-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .staples-page__list-card {
      padding: var(--spacing-card);
    }

    .staples-page__list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .staples-page__list-header h3 {
      margin: 0;
    }

    .staples-page__empty {
      text-align: center;
      padding: 2rem;
      color: var(--on-surface-variant);
    }

    .staples-page__list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .staples-page__item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.625rem 0;
    }

    .staples-page__item + .staples-page__item {
      border-top: 1px solid var(--outline-variant);
    }

    .staples-page__item-name {
      text-transform: capitalize;
      font-weight: 500;
      color: var(--on-surface);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    @media (max-width: 640px) {
      .staples-page__grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class StaplesConfigComponent implements OnInit {
  private readonly staplesService = inject(StaplesService);

  readonly items = signal<string[]>([]);
  readonly newStapleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  ngOnInit(): void {
    this.loadStaples();
  }

  addStaple(): void {
    const name = this.newStapleControl.value.trim();
    if (!name) return;

    const current = this.items();
    if (current.some((s) => s.toLowerCase() === name.toLowerCase())) {
      return; // already exists
    }

    const updated = [...current, name];
    this.staplesService.updateStaples({ items: updated }).subscribe(() => {
      this.items.set(updated);
      this.newStapleControl.reset();
    });
  }

  removeStaple(item: string): void {
    const updated = this.items().filter((s) => s !== item);
    this.staplesService.updateStaples({ items: updated }).subscribe(() => {
      this.items.set(updated);
    });
  }

  private loadStaples(): void {
    this.staplesService.getStaples().subscribe((config) => {
      this.items.set(config.items);
    });
  }
}
