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
          <label for="pantrySearch">Search</label>
          <input id="pantrySearch" type="text" [formControl]="searchControl" placeholder="Search pantry..." (input)="emitFilters()" />
        </div>
        <div class="filter-group">
          <label for="categoryFilter">Category</label>
          <select id="categoryFilter" [formControl]="categoryControl" (change)="emitFilters()">
            <option value="">All</option>
            @for (cat of categoryOptions; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>
        <button type="button" class="btn btn--small" (click)="resetFilters()">Reset</button>
      </div>
    </div>
  `,
  styles: [`
    .pantry-filters { margin-bottom: 1.5rem; padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .filter-group label { font-size: 0.75rem; font-weight: 500; color: #666; }
    .filter-group input, .filter-group select { padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.875rem; }
    .btn { padding: 0.375rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 0.8125rem; }
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
