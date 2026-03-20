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
            <div class="card recipe-card" role="listitem">
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
    .recipe-list__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .recipe-list__header h2 {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 400;
      color: var(--on-surface);
      margin: 0;
    }

    .recipe-list__empty {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--on-surface-variant);
    }

    .recipe-list__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .recipe-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .recipe-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .recipe-card__title {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 400;
      color: var(--primary);
      text-decoration: none;
    }

    .recipe-card__title:hover {
      color: var(--primary-hover);
    }

    .recipe-card__description {
      color: var(--on-surface-variant);
      font-size: 0.875rem;
      margin: 0;
      line-height: 1.5;
    }

    .recipe-card__meta {
      display: flex;
      gap: 1rem;
      font-size: 0.8125rem;
      color: var(--on-surface-variant);
    }

    .recipe-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .recipe-card__actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--outline-variant);
    }
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
    const f = this.currentFilters;
    return !!(f.query || f.difficulty || f.maxPrepTime || f.tags
      || f.cuisines.length || f.proteins.length || f.courses.length);
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
      if (filters?.cuisines?.length) {
        filtered = filtered.filter((r) =>
          filters.cuisines.some((c) => r.tags.some((t) => t.toLowerCase() === c.toLowerCase())));
      }
      if (filters?.proteins?.length) {
        filtered = filtered.filter((r) =>
          filters.proteins.some((p) => r.tags.some((t) => t.toLowerCase() === p.toLowerCase())));
      }
      if (filters?.courses?.length) {
        const nonMainCourses = ['dessert', 'appetizer', 'soup', 'snack'];
        filtered = filtered.filter((r) => {
          const rTags = r.tags.map((t) => t.toLowerCase());
          return filters.courses.some((c) => {
            if (c.toLowerCase() === 'main') {
              return !nonMainCourses.some((nm) => rTags.includes(nm));
            }
            return rTags.includes(c.toLowerCase());
          });
        });
      }
      this.items.set(filtered);
    });
  }
}
