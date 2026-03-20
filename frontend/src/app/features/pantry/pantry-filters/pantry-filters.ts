import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

export interface PantryFilters {
  query: string;
  category: string;
}

@Component({
  selector: 'app-pantry-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="pantry-filters">
      <div class="filter-row">
        <div class="filter-group">
          <label for="pantrySearch" class="label-text">Search</label>
          <input id="pantrySearch" type="text" class="input" [formControl]="searchControl" placeholder="Search pantry..." (input)="emitFilters()" />
        </div>
        <div class="filter-group">
          <label for="categoryFilter" class="label-text">Category</label>
          <select id="categoryFilter" class="input" [formControl]="categoryControl" (change)="emitFilters()">
            <option value="">All</option>
            @for (cat of categoryOptions; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>
        <button type="button" class="btn btn--ghost" (click)="resetFilters()">Reset</button>
      </div>
    </div>
  `,
  styles: [`
    .pantry-filters {
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--surface-container-low);
      border-radius: var(--radius-xl);
    }

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      flex: 1;
      min-width: 160px;
    }

    .filter-group .input {
      min-width: 0;
    }

    .btn {
      align-self: flex-end;
    }
  `],
})
export class PantryFiltersComponent {
  readonly filtersChanged = output<PantryFilters>();
  readonly categoryOptions = Object.values(PantryCategory);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryControl = new FormControl('', { nonNullable: true });

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      category: this.categoryControl.value,
    });
  }

  resetFilters(): void {
    this.searchControl.reset();
    this.categoryControl.reset();
    this.emitFilters();
  }
}
