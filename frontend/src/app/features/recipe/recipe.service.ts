import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import { Recipe } from '../../shared/models/recipe.model';
import { RecipeTranslation } from '../../shared/models/translation.model';
import { bcp47Of, type Locale } from '../../shared/i18n';
import { environment } from '../../../environments/environment';
import { PantryContextService } from '../../shared/services/pantry-context.service';

/** The list envelope the API answers with. */
interface PagedRecipes {
  data: Recipe[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
}

/**
 * Accept either response shape.
 *
 * When the list moved to a `{data, meta}` envelope, every browser holding a
 * cached copy of the previous bundle got the new response and crashed on
 * `TypeError: i is not iterable` — an empty recipe list that looked like data
 * loss until the service worker updated a load later. Tolerating both shapes
 * costs three lines and means the next contract change cannot do that again.
 */
function normalisePage(response: PagedRecipes | Recipe[], offset: number): PagedRecipes {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: { total: response.length, limit: response.length, offset, hasMore: false },
    };
  }
  return response;
}

/** A write payload plus the other languages' text for the same recipe. */
type RecipeWrite<T> = T & { translations?: RecipeTranslation[] };

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);
  private readonly pantryContext = inject(PantryContextService);
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
    return this.http
      .get<PagedRecipes | Recipe[]>(this.baseUrl, { params: { offset: String(offset) } })
      .pipe(map((response) => normalisePage(response, offset)));
  }

  getById(id: string): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.baseUrl}/${id}`);
  }

  /** Every language stored for a recipe — drives the per-language editing tabs. */
  getTranslations(id: string): Observable<RecipeTranslation[]> {
    return this.http.get<RecipeTranslation[]>(`${this.baseUrl}/${id}/translations`);
  }

  /**
   * Add a recipe, pinned to the kitchen currently on screen.
   *
   * The pantry id is sent explicitly rather than through the kitchen-scoped
   * interceptor, which covers reads too — the recipe list is a shared library
   * and has no business carrying one. The server still checks membership; this
   * only says WHICH of the author's kitchens they meant, so that someone
   * working in the summerhouse does not file a private recipe at home.
   */
  create(recipe: RecipeWrite<Omit<Recipe, 'id'>>, authoringLocale?: Locale): Observable<Recipe> {
    const pantryId = this.pantryContext.currentId();
    return this.http.post<Recipe>(this.baseUrl, recipe, {
      ...authoringHeader(authoringLocale),
      ...(pantryId ? { params: { pantryId } } : {}),
    });
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

  /**
   * Hand a recipe to the person who actually cooked it.
   *
   * Its own call rather than a field on `update`, because it gives away control:
   * once it lands, this user can no longer edit or delete the recipe.
   */
  transferAuthor(id: string, userId: string): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.baseUrl}/${id}/transfer`, { userId });
  }

  /**
   * Replace a recipe's hero image with an uploaded file.
   *
   * The path that needs no API key from anyone — which is what keeps the library
   * usable for a cook with no Gemini account now that there is no shared key.
   * Deliberately sends FormData and sets no Content-Type: the browser has to add
   * the multipart boundary, and setting the header by hand strips it.
   */
  uploadImage(id: string, file: File): Observable<Recipe> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<Recipe>(`${this.baseUrl}/${id}/image`, form);
  }

  /**
   * Generate images using the CALLER'S Gemini key.
   *
   * The key is a request parameter, not something the server looks up: the stored
   * copy is encrypted with a passphrase only the user knows, and a user may
   * choose to supply a key without storing it at all.
   */
  regenerateImages(id: string, apiKey: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/regenerate-images`, {
      apiKey,
    });
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
