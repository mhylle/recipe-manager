import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { expand, reduce } from 'rxjs/operators';
import { Recipe } from '../../shared/models/recipe.model';
import { RecipeTranslation } from '../../shared/models/translation.model';
import { bcp47Of, type Locale } from '../../shared/i18n';
import { environment } from '../../../environments/environment';

/** The list envelope the API answers with. */
interface PagedRecipes {
  data: Recipe[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
}

/** A write payload plus the other languages' text for the same recipe. */
type RecipeWrite<T> = T & { translations?: RecipeTranslation[] };

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/recipes`;

  /**
   * Every recipe.
   *
   * The list, the meal-plan grid and the recipe picker all filter and sort
   * client-side, so they need the whole collection rather than a page. The API
   * paginates, so this follows `hasMore` to exhaustion — taking only the first
   * page would silently hide every recipe past the hundredth, and would read as
   * a sorting bug rather than a missing fetch.
   */
  getAll(): Observable<Recipe[]> {
    return this.fetchPage(0).pipe(
      expand((page) =>
        // The empty check is not redundant with hasMore: a server reporting
        // hasMore while returning no rows would make the offset stand still and
        // spin requests until the tab died.
        page.meta.hasMore && page.data.length > 0
          ? this.fetchPage(page.meta.offset + page.data.length)
          : EMPTY,
      ),
      reduce((all, page) => [...all, ...page.data], [] as Recipe[]),
    );
  }

  private fetchPage(offset: number): Observable<PagedRecipes> {
    return this.http.get<PagedRecipes>(this.baseUrl, {
      params: { offset: String(offset) },
    });
  }

  getById(id: string): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.baseUrl}/${id}`);
  }

  /** Every language stored for a recipe — drives the per-language editing tabs. */
  getTranslations(id: string): Observable<RecipeTranslation[]> {
    return this.http.get<RecipeTranslation[]>(`${this.baseUrl}/${id}/translations`);
  }

  create(recipe: RecipeWrite<Omit<Recipe, 'id'>>, authoringLocale?: Locale): Observable<Recipe> {
    return this.http.post<Recipe>(this.baseUrl, recipe, authoringHeader(authoringLocale));
  }

  update(
    id: string,
    recipe: RecipeWrite<Partial<Recipe>>,
    authoringLocale?: Locale,
  ): Observable<Recipe> {
    return this.http.patch<Recipe>(
      `${this.baseUrl}/${id}`,
      recipe,
      authoringHeader(authoringLocale),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  regenerateImages(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/regenerate-images`, {});
  }
}

/**
 * Pin the request to the language actually being AUTHORED, which is the tab the
 * user has open — not necessarily the language the UI is displayed in. The locale
 * interceptor deliberately yields to a caller-set Accept-Language, so this is the
 * supported way to say "these words are Danish" while reading the UI in English.
 */
function authoringHeader(locale: Locale | undefined) {
  return locale ? { headers: { 'Accept-Language': bcp47Of(locale) } } : {};
}
