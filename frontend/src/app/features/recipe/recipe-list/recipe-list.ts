import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { RecipeFiltersComponent, RecipeFilters } from '../recipe-filters/recipe-filters';

@Component({
  selector: 'app-recipe-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecipeFiltersComponent],
  template: `
    <div class="recipe-list">
      <div class="recipe-list__header">
        <h2>Recipes</h2>
        <a routerLink="/recipes/new" class="btn btn--primary">Add Recipe</a>
      </div>

      <app-recipe-filters (filtersChanged)="onFiltersChanged($event)" />

      @if (items().length === 0) {
        <p class="recipe-list__empty" role="status">
          {{ hasActiveFilters() ? 'No recipes match the current filters.' : 'No recipes yet. Add your first recipe to get started.' }}
        </p>
      } @else {
        <div class="recipe-list__grid" role="list">
          @for (recipe of items(); track recipe.id) {
            <div class="recipe-card" role="listitem">
              <div class="recipe-card__header">
                <a [routerLink]="['/recipes', recipe.id]" class="recipe-card__title">{{ recipe.name }}</a>
                <span class="recipe-card__difficulty" [class]="'badge badge--' + recipe.difficulty">{{ recipe.difficulty }}</span>
              </div>
              <p class="recipe-card__description">{{ recipe.description }}</p>
              <div class="recipe-card__meta">
                <span class="recipe-card__time" aria-label="Prep time">Prep: {{ recipe.prepTime }}min</span>
                <span class="recipe-card__time" aria-label="Cook time">Cook: {{ recipe.cookTime }}min</span>
                <span class="recipe-card__servings" aria-label="Servings">{{ recipe.servings }} servings</span>
              </div>
              @if (recipe.tags.length > 0) {
                <div class="recipe-card__tags">
                  @for (tag of recipe.tags; track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </div>
              }
              <div class="recipe-card__actions">
                <a [routerLink]="['/recipes', recipe.id, 'edit']" class="btn btn--small">Edit</a>
                <button type="button" class="btn btn--small btn--danger" (click)="onDelete(recipe)" [attr.aria-label]="'Delete ' + recipe.name">Delete</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .recipe-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .recipe-list__empty { text-align: center; padding: 2rem; color: #666; }
    .recipe-list__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .recipe-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .recipe-card__header { display: flex; justify-content: space-between; align-items: flex-start; }
    .recipe-card__title { font-size: 1.125rem; font-weight: 600; color: #1976d2; text-decoration: none; }
    .recipe-card__title:hover { text-decoration: underline; }
    .recipe-card__description { color: #666; font-size: 0.875rem; margin: 0; }
    .recipe-card__meta { display: flex; gap: 1rem; font-size: 0.8125rem; color: #888; }
    .recipe-card__tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .tag { display: inline-block; padding: 0.125rem 0.5rem; background-color: #e3f2fd; color: #1565c0; border-radius: 12px; font-size: 0.75rem; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; text-transform: capitalize; }
    .badge--easy { background-color: #e8f5e9; color: #2e7d32; }
    .badge--medium { background-color: #fff3e0; color: #ef6c00; }
    .badge--hard { background-color: #fce4ec; color: #c62828; }
    .recipe-card__actions { display: flex; gap: 0.5rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #f0f0f0; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; font-size: 0.875rem; }
    .btn--primary { background-color: #1976d2; color: white; }
    .btn--primary:hover { background-color: #1565c0; }
    .btn--small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
    .btn--danger { background-color: #d32f2f; color: white; }
    .btn--danger:hover { background-color: #c62828; }
  `],
})
export class RecipeListComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);

  readonly items = signal<Recipe[]>([]);
  private currentFilters: RecipeFilters | null = null;

  ngOnInit(): void {
    this.loadItems();
  }

  hasActiveFilters(): boolean {
    if (!this.currentFilters) return false;
    return !!(this.currentFilters.query || this.currentFilters.difficulty || this.currentFilters.maxPrepTime || this.currentFilters.tags);
  }

  onFiltersChanged(filters: RecipeFilters): void {
    this.currentFilters = filters;
    this.loadItems(filters);
  }

  onDelete(recipe: Recipe): void {
    if (confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
      this.recipeService.delete(recipe.id).subscribe(() => {
        this.loadItems(this.currentFilters ?? undefined);
      });
    }
  }

  private loadItems(filters?: RecipeFilters): void {
    // Build query params
    const params: Record<string, string> = {};
    if (filters?.query) params['q'] = filters.query;
    if (filters?.difficulty) params['difficulty'] = filters.difficulty;
    if (filters?.maxPrepTime) params['maxPrepTime'] = String(filters.maxPrepTime);
    if (filters?.tags) params['tags'] = filters.tags;

    // For simplicity, load all and filter client-side if no params,
    // or call getAll with query string if params exist
    this.recipeService.getAll().subscribe((items) => {
      let filtered = items;
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        filtered = filtered.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
      }
      if (filters?.difficulty) {
        filtered = filtered.filter((r) => r.difficulty === filters.difficulty);
      }
      if (filters?.maxPrepTime) {
        filtered = filtered.filter((r) => r.prepTime <= filters.maxPrepTime!);
      }
      if (filters?.tags) {
        const tags = filters.tags.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
        if (tags.length > 0) {
          filtered = filtered.filter((r) => tags.every((tag) => r.tags.some((t) => t.toLowerCase() === tag)));
        }
      }
      this.items.set(filtered);
    });
  }
}
