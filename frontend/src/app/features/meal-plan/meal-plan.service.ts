import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MealPlan } from '../../shared/models/meal-plan.model';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { MealType } from '../../shared/enums/meal-type.enum';

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/meal-plans';

  getByWeek(weekStartDate: string): Observable<MealPlan> {
    return this.http.get<MealPlan>(`${this.baseUrl}/week?date=${weekStartDate}`);
  }

  addEntry(planId: string, entry: { day: DayOfWeek; meal: MealType; recipeId: string; servings: number }): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.baseUrl}/${planId}/entries`, entry);
  }

  removeEntry(planId: string, entryIndex: number): Observable<MealPlan> {
    return this.http.delete<MealPlan>(`${this.baseUrl}/${planId}/entries/${entryIndex}`);
  }

  confirmCooked(planId: string, entryIndex: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${planId}/entries/${entryIndex}/confirm`, {});
  }
}
