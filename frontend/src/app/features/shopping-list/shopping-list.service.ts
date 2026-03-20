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

  toggleItem(listId: string, itemIndex: number): Observable<ShoppingList> {
    return this.http.patch<ShoppingList>(`${this.baseUrl}/${listId}/items/${itemIndex}`, {});
  }

  generateFromRecipe(recipeId: string, servings?: number): Observable<ShoppingList> {
    const params = servings ? `?servings=${servings}` : '';
    return this.http.post<ShoppingList>(`${this.baseUrl}/from-recipe/${recipeId}${params}`, {});
  }
}
