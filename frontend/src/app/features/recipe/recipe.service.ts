import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe } from '../../shared/models/recipe.model';
import { RecipeTranslation } from '../../shared/models/translation.model';
import { bcp47Of, type Locale } from '../../shared/i18n';
import { environment } from '../../../environments/environment';

/** A write payload plus the other languages' text for the same recipe. */
type RecipeWrite<T> = T & { translations?: RecipeTranslation[] };

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/recipes`;

  getAll(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(this.baseUrl);
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
