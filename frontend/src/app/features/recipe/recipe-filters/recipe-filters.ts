import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Difficulty } from '../../../shared/enums/difficulty.enum';

export interface RecipeFilters {
  query: string;
  difficulty: string;
  maxPrepTime: number | null;
  tags: string;
}

@Component({
  selector: 'app-recipe-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="recipe-filters">
      <div class="filter-row">
        <div class="filter-group">
          <label for="search">Search</label>
          <input id="search" type="text" [formControl]="searchControl" placeholder="Search recipes..." (input)="emitFilters()" />
        </div>
        <div class="filter-group">
          <label for="difficulty">Difficulty</label>
          <select id="difficulty" [formControl]="difficultyControl" (change)="emitFilters()">
            <option value="">All</option>
            @for (d of difficultyOptions; track d) {
              <option [value]="d">{{ d }}</option>
            }
          </select>
        </div>
        <div class="filter-group">
          <label for="maxPrep">Max Prep (min)</label>
          <input id="maxPrep" type="number" [formControl]="maxPrepControl" min="0" placeholder="Any" (input)="emitFilters()" />
        </div>
        <div class="filter-group">
          <label for="tags">Tags</label>
          <input id="tags" type="text" [formControl]="tagsControl" placeholder="e.g. italian, quick" (input)="emitFilters()" />
        </div>
        <button type="button" class="btn btn--small" (click)="resetFilters()">Reset</button>
      </div>
    </div>
  `,
  styles: [`
    .recipe-filters { margin-bottom: 1.5rem; padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .filter-group label { font-size: 0.75rem; font-weight: 500; color: #666; }
    .filter-group input, .filter-group select { padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.875rem; }
    .btn { padding: 0.375rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 0.8125rem; }
    .btn:hover { background: #f5f5f5; }
  `],
})
export class RecipeFiltersComponent {
  readonly filtersChanged = output<RecipeFilters>();

  readonly difficultyOptions = Object.values(Difficulty);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly difficultyControl = new FormControl('', { nonNullable: true });
  readonly maxPrepControl = new FormControl<number | null>(null);
  readonly tagsControl = new FormControl('', { nonNullable: true });

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      difficulty: this.difficultyControl.value,
      maxPrepTime: this.maxPrepControl.value,
      tags: this.tagsControl.value,
    });
  }

  resetFilters(): void {
    this.searchControl.reset();
    this.difficultyControl.reset();
    this.maxPrepControl.reset();
    this.tagsControl.reset();
    this.emitFilters();
  }
}
