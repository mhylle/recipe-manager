import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Difficulty } from '../../../shared/enums/difficulty.enum';

export interface RecipeFilters {
  query: string;
  difficulty: string;
  maxPrepTime: number | null;
  tags: string;
  cuisines: string[];
  proteins: string[];
  courses: string[];
}

@Component({
  selector: 'app-recipe-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="recipe-filters">
      <div class="chip-groups">
        <div class="chip-group" role="group" aria-label="Filter by cuisine">
          <span class="chip-group__label">Cuisine</span>
          @for (option of cuisineOptions; track option) {
            <button type="button" class="chip"
              [class.chip--active]="activeCuisines().has(option)"
              [attr.aria-pressed]="activeCuisines().has(option)"
              (click)="toggleCuisine(option)">{{ option }}</button>
          }
        </div>
        <div class="chip-group" role="group" aria-label="Filter by protein">
          <span class="chip-group__label">Protein</span>
          @for (option of proteinOptions; track option) {
            <button type="button" class="chip"
              [class.chip--active]="activeProteins().has(option)"
              [attr.aria-pressed]="activeProteins().has(option)"
              (click)="toggleProtein(option)">{{ option }}</button>
          }
        </div>
        <div class="chip-group" role="group" aria-label="Filter by course">
          <span class="chip-group__label">Course</span>
          @for (option of courseOptions; track option) {
            <button type="button" class="chip"
              [class.chip--active]="activeCourses().has(option)"
              [attr.aria-pressed]="activeCourses().has(option)"
              (click)="toggleCourse(option)">{{ option }}</button>
          }
        </div>
      </div>

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
          <input id="tags" type="text" [formControl]="tagsControl" placeholder="e.g. slow-cooked, quick" (input)="emitFilters()" />
        </div>
        <button type="button" class="btn btn--small" (click)="resetFilters()">Reset</button>
      </div>
    </div>
  `,
  styles: [`
    .recipe-filters { margin-bottom: 1.5rem; padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; display: flex; flex-direction: column; gap: 0.75rem; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .filter-group label { font-size: 0.75rem; font-weight: 500; color: #666; }
    .filter-group input, .filter-group select { padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.875rem; }
    .btn { padding: 0.375rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 0.8125rem; }
    .btn:hover { background: #f5f5f5; }

    .chip-groups { display: flex; flex-direction: column; gap: 0.5rem; }
    .chip-group { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }
    .chip-group__label { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; min-width: 4rem; }
    .chip {
      display: inline-flex; align-items: center; padding: 0.25rem 0.625rem;
      border: 1px solid #ccc; border-radius: 16px; background: white;
      font-size: 0.75rem; cursor: pointer; transition: all 0.15s ease;
      color: #555; line-height: 1.2;
    }
    .chip:hover { border-color: #1976d2; color: #1976d2; }
    .chip--active { background: #1976d2; color: white; border-color: #1976d2; }
    .chip--active:hover { background: #1565c0; border-color: #1565c0; }
  `],
})
export class RecipeFiltersComponent {
  readonly filtersChanged = output<RecipeFilters>();

  readonly difficultyOptions = Object.values(Difficulty);
  readonly cuisineOptions = ['Mexican', 'Italian', 'Thai', 'Japanese', 'Danish', 'French'];
  readonly proteinOptions = ['Chicken', 'Pork', 'Beef', 'Fish', 'Vegetarian'];
  readonly courseOptions = ['Main', 'Dessert', 'Appetizer', 'Soup', 'Snack'];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly difficultyControl = new FormControl('', { nonNullable: true });
  readonly maxPrepControl = new FormControl<number | null>(null);
  readonly tagsControl = new FormControl('', { nonNullable: true });

  readonly activeCuisines = signal<Set<string>>(new Set());
  readonly activeProteins = signal<Set<string>>(new Set());
  readonly activeCourses = signal<Set<string>>(new Set());

  toggleCuisine(value: string): void {
    this.activeCuisines.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  toggleProtein(value: string): void {
    this.activeProteins.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  toggleCourse(value: string): void {
    this.activeCourses.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      difficulty: this.difficultyControl.value,
      maxPrepTime: this.maxPrepControl.value,
      tags: this.tagsControl.value,
      cuisines: Array.from(this.activeCuisines()),
      proteins: Array.from(this.activeProteins()),
      courses: Array.from(this.activeCourses()),
    });
  }

  resetFilters(): void {
    this.searchControl.reset();
    this.difficultyControl.reset();
    this.maxPrepControl.reset();
    this.tagsControl.reset();
    this.activeCuisines.set(new Set());
    this.activeProteins.set(new Set());
    this.activeCourses.set(new Set());
    this.emitFilters();
  }
}
