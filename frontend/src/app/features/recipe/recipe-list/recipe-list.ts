import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { RecipeFiltersComponent, RecipeFilters } from '../recipe-filters/recipe-filters';
import { EnumLabelPipe, LocaleService, TranslatePipe, reloadOnLocaleChange } from '../../../shared/i18n';
import { AuthService } from '../../../shared/services/auth.service';
import {
  DEFAULT_RECIPE_SORT,
  RECIPE_SORT_OPTIONS,
  RecipeSort,
  isRecipeSort,
  sortRecipes,
} from '../recipe-sort';
import { matchesCourse } from '../recipe-tags';
import {
  RECIPE_VIEW_MODES,
  RecipeViewMode,
  isRecipeViewMode,
  readStoredViewMode,
  writeStoredViewMode,
} from '../recipe-view-mode';

/**
 * How many gallery cards to render at a time.
 *
 * The gallery is the expensive view: each card carries a photograph, and the
 * hero images are megabytes each, so rendering the whole collection asked the
 * browser for tens of megabytes on one page load. The list and table views show
 * no images and stay whole — paginating them would only break Ctrl+F.
 */
const GALLERY_PAGE = 12;

@Component({
  selector: 'app-recipe-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecipeFiltersComponent, TranslatePipe, EnumLabelPipe],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.scss',
})
export class RecipeListComponent {
  readonly auth = inject(AuthService);

  /**
   * Only the person who added a recipe may change it. The server enforces this;
   * hiding the buttons keeps the UI honest about what will actually work.
   *
   * Compares against our LOCAL user id, which is what `createdBy.id` holds —
   * the auth-service's id is a different number entirely.
   */
  canEdit(recipe: Recipe): boolean {
    const me = this.auth.localUserId();
    return !!me && recipe.createdBy?.id === me;
  }

  private readonly recipeService = inject(RecipeService);
  private readonly locale = inject(LocaleService);

  readonly items = signal<Recipe[]>([]);
  private currentFilters: RecipeFilters | null = null;

  readonly viewModes = RECIPE_VIEW_MODES;

  /** Layout choice, remembered between visits. Defaults to the original cards. */
  readonly viewMode = signal<RecipeViewMode>(readStoredViewMode());

  readonly sortOptions = RECIPE_SORT_OPTIONS;
  readonly sortOrder = signal<RecipeSort>(DEFAULT_RECIPE_SORT);

  /**
   * What the template renders. Recomputes when the list, the chosen order or the
   * LANGUAGE changes — the last one matters because names are translated and
   * Danish collates æ/ø/å differently from English, so the correct order is not
   * the same in both languages.
   */
  readonly sortedItems = computed(() =>
    sortRecipes(this.items(), this.sortOrder(), this.locale.locale()),
  );

  /**
   * How many gallery cards are currently rendered.
   *
   * Sorting and filtering stay client-side over the whole collection — which is
   * why the service fetches every page — so this windows the RENDER, not the
   * data. Narrowing a filter therefore still searches everything.
   */
  readonly visibleCount = signal(GALLERY_PAGE);

  readonly galleryItems = computed(() => this.sortedItems().slice(0, this.visibleCount()));

  readonly hasMoreToShow = computed(() => this.sortedItems().length > this.visibleCount());

  /** How many are still hidden, so the control can say what it will do. */
  readonly remainingCount = computed(() =>
    Math.max(0, this.sortedItems().length - this.visibleCount()),
  );

  showMore(): void {
    this.visibleCount.update((n) => n + GALLERY_PAGE);
  }

  // Re-fetches on every language switch; API content is localised server-side.
  private readonly reload = reloadOnLocaleChange(() => this.loadItems());

  hasActiveFilters(): boolean {
    if (!this.currentFilters) return false;
    const f = this.currentFilters;
    return !!(f.query || f.difficulty || f.maxPrepTime || f.tags
      || f.cuisines.length || f.proteins.length || f.courses.length);
  }

  /** First letter, for the gallery placeholder when a recipe has no photograph. */
  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }

  onViewModeChange(mode: RecipeViewMode): void {
    if (!isRecipeViewMode(mode)) {
      return;
    }
    this.viewMode.set(mode);
    writeStoredViewMode(mode);
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isRecipeSort(value)) {
      this.sortOrder.set(value);
    }
  }

  onFiltersChanged(filters: RecipeFilters): void {
    this.currentFilters = filters;
    // Back to the top of the window: a new search should start at its first
    // result, not partway down because the previous one had been scrolled.
    this.visibleCount.set(GALLERY_PAGE);
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
          // Substring, not equality: typing "per" should reach "personal"
          // without having to spell the whole tag (#59). It matches anywhere in
          // the tag rather than only the start, which is broader — "per" also
          // finds "pepper" — but that is what searching a short tag list wants.
          //
          // Still EVERY term, not any: adding a second word is how someone
          // narrows a result set, and switching to `some` would widen it.
          filtered = filtered.filter((r) =>
            tags.every((tag) => r.tags.some((t) => t.toLowerCase().includes(tag))),
          );
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
        filtered = filtered.filter((r) =>
          filters.courses.some((c) => matchesCourse(r.tags, c)));
      }
      this.items.set(filtered);
    });
  }
}
