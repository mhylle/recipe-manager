import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { RecipeFiltersComponent, RecipeFilters } from '../recipe-filters/recipe-filters';
import { EnumLabelPipe, LocaleService, TranslatePipe, reloadOnLocaleChange } from '../../../shared/i18n';

@Component({
  selector: 'app-recipe-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecipeFiltersComponent, TranslatePipe, EnumLabelPipe],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.scss',
})
export class RecipeListComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly locale = inject(LocaleService);

  readonly items = signal<Recipe[]>([]);
  private currentFilters: RecipeFilters | null = null;

  // Re-fetches on every language switch; API content is localised server-side.
  private readonly reload = reloadOnLocaleChange(() => this.loadItems());

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
    if (confirm(this.locale.translate('common.confirm.delete', { name: recipe.name }))) {
      this.recipeService.delete(recipe.id).subscribe(() => {
        this.loadItems(this.currentFilters ?? undefined);
      });
    }
  }

  /** Re-fetch from the API. Public: the locale effect and the specs both drive it. */
  loadItems(filters?: RecipeFilters): void {
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
