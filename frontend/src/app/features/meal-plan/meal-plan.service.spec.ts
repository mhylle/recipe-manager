import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MealPlanService } from './meal-plan.service';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { MealType } from '../../shared/enums/meal-type.enum';

describe('MealPlanService', () => {
  let service: MealPlanService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MealPlanService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('getByWeek should call GET with week date', () => {
    service.getByWeek('2026-03-16').subscribe();
    const req = httpTesting.expectOne('/api/meal-plans/week?date=2026-03-16');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'p1', weekStartDate: '2026-03-16', entries: [] });
  });

  it('addEntry should POST to entries endpoint', () => {
    const entry = { day: DayOfWeek.MONDAY, meal: MealType.DINNER, recipeId: 'r1', servings: 4 };
    service.addEntry('p1', entry).subscribe();
    const req = httpTesting.expectOne('/api/meal-plans/p1/entries');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(entry);
    req.flush({ id: 'p1', weekStartDate: '2026-03-16', entries: [entry] });
  });

  it('removeEntry should DELETE entry by index', () => {
    service.removeEntry('p1', 0).subscribe();
    const req = httpTesting.expectOne('/api/meal-plans/p1/entries/0');
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'p1', weekStartDate: '2026-03-16', entries: [] });
  });

  it('confirmCooked should POST to confirm endpoint', () => {
    service.confirmCooked('p1', 0).subscribe();
    const req = httpTesting.expectOne('/api/meal-plans/p1/entries/0/confirm');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
