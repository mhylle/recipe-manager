import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MealPlan } from '../../shared/models/meal-plan.model';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { MealType } from '../../shared/enums/meal-type.enum';
import { environment } from '../../../environments/environment';

/** A slot in the week: which day, which meal. */
export interface MealSlot {
  day: DayOfWeek;
  meal: MealType;
}

/** What to do with an entry already occupying the chosen slot. */
export interface DisplaceRequest {
  index: number;
  expectRecipeId: string;
  /** Absent removes the displaced entry; present moves it there instead. */
  to?: MealSlot;
}

export interface AddEntryRequest extends MealSlot {
  recipeId: string;
  servings: number;
  displace?: DisplaceRequest;
}

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/meal-plans`;

  getByWeek(weekStartDate: string): Observable<MealPlan> {
    return this.http.get<MealPlan>(`${this.baseUrl}/week?date=${weekStartDate}`);
  }

  /**
   * Plan a recipe into a slot.
   *
   * A slot may hold more than one meal, so this adds alongside anything already
   * there unless `displace` says otherwise. Both halves of a displacement are
   * one request: sequencing a delete and an add from here would risk losing a
   * meal if the second call failed.
   *
   * `displace.expectRecipeId` is what the caller believes sits at that index.
   * Indices are positional, so a housemate editing the plan shifts them — the
   * server compares before deleting and refuses on a mismatch rather than
   * throwing away whatever moved into that position.
   */
  addEntry(planId: string, entry: AddEntryRequest): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.baseUrl}/${planId}/entries`, entry);
  }

  removeEntry(planId: string, entryIndex: number): Observable<MealPlan> {
    return this.http.delete<MealPlan>(`${this.baseUrl}/${planId}/entries/${entryIndex}`);
  }

  confirmCooked(planId: string, entryIndex: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${planId}/entries/${entryIndex}/confirm`, {});
  }
}
