import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe } from '../../shared/models/recipe.model';
import { environment } from '../../../environments/environment';

export interface MissingIngredient {
  name: string;
  required: number;
  available: number;
  unit: string;
}

export interface AlmostCanMakeEntry {
  recipe: Recipe;
  missingIngredients: MissingIngredient[];
  usesExpiringIngredients?: boolean;
}

export interface MatchResult {
  canMakeNow: Recipe[];
  almostCanMake: AlmostCanMakeEntry[];
  missingMany: Recipe[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getMatchResults(): Observable<MatchResult> {
    return this.http.get<MatchResult>(`${environment.apiBase}/api/recipes/match`);
  }
}
