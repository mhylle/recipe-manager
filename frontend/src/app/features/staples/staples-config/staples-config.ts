import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { StaplesService } from '../staples.service';

@Component({
  selector: 'app-staples-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="staples-config">
      <h2>Staples Configuration</h2>
      <p class="staples-config__description">
        Staples are ingredients you always have on hand (like salt, pepper, oil).
        They will be excluded from recipe matching calculations.
      </p>

      <div class="staples-config__add">
        <label for="newStaple" class="sr-only">New staple name</label>
        <input
          id="newStaple"
          type="text"
          [formControl]="newStapleControl"
          placeholder="Add a staple ingredient..."
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

      @if (items().length === 0) {
        <p class="staples-config__empty" role="status">
          No staples configured. Add items you always have on hand.
        </p>
      } @else {
        <ul class="staples-config__list" role="list">
          @for (item of items(); track item) {
            <li class="staples-config__item">
              <span>{{ item }}</span>
              <button
                type="button"
                class="btn btn--small btn--danger"
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
  `,
  styles: [`
    .staples-config {
      max-width: 500px;
    }

    .staples-config__description {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .staples-config__add {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .staples-config__add input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .staples-config__empty {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .staples-config__list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .staples-config__item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .staples-config__item span {
      text-transform: capitalize;
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

    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .btn--primary {
      background-color: #1976d2;
      color: white;
    }

    .btn--primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn--small {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn--danger {
      background-color: #d32f2f;
      color: white;
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
