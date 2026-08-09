import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShoppingList } from '../../shared/models/shopping-list.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/shopping-lists`;

  generate(mealPlanId: string): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(`${this.baseUrl}/generate/${mealPlanId}`, {});
  }

  getById(id: string): Observable<ShoppingList> {
    return this.http.get<ShoppingList>(`${this.baseUrl}/${id}`);
  }

  /**
   * The list this kitchen is shopping from, or null when there is none.
   *
   * Null is an ordinary answer, not an error — a kitchen that has never
   * generated a list is in a perfectly normal state.
   */
  current(): Observable<ShoppingList | null> {
    return this.http.get<ShoppingList | null>(`${this.baseUrl}/current`);
  }

  /** Put the list away once the shopping is done. */
  archive(listId: string): Observable<ShoppingList> {
    return this.http.patch<ShoppingList>(`${this.baseUrl}/${listId}/archive`, {});
  }

  toggleItem(listId: string, itemIndex: number): Observable<ShoppingList> {
    return this.http.patch<ShoppingList>(`${this.baseUrl}/${listId}/items/${itemIndex}`, {});
  }

  /**
   * Shop for one recipe, cooked the way the reader chose.
   *
   * `variationId` matters more than it looks: a variation can ADD an ingredient
   * the recipe has none of — the teriyaki's garlic, the ciabatta's sugar — so
   * leaving it out does not produce a slightly wrong list, it produces one that
   * cannot contain them at all.
   */
  generateFromRecipe(
    recipeId: string,
    servings?: number,
    variationId?: string,
  ): Observable<ShoppingList> {
    const params = new URLSearchParams();
    if (servings) params.set('servings', String(servings));
    if (variationId) params.set('variation', variationId);
    const query = params.toString();
    return this.http.post<ShoppingList>(
      `${this.baseUrl}/from-recipe/${recipeId}${query ? `?${query}` : ''}`,
      {},
    );
  }
}
