import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { MealPlanGridComponent } from './meal-plan-grid';
import { MealPlanService } from '../meal-plan.service';
import { RecipeService } from '../../recipe/recipe.service';
import { DayOfWeek } from '../../../shared/enums/day-of-week.enum';
import { MealType } from '../../../shared/enums/meal-type.enum';

describe('MealPlanGridComponent', () => {
  let fixture: ComponentFixture<MealPlanGridComponent>;
  let component: MealPlanGridComponent;

  const mockPlan = {
    id: 'plan-1',
    weekStartDate: '2026-03-16',
    entries: [
      { day: DayOfWeek.MONDAY, meal: MealType.DINNER, recipeId: 'r1', servings: 4 },
    ],
  };

  beforeEach(async () => {
    const mockMealPlanService = {
      getByWeek: vi.fn().mockReturnValue(of(mockPlan)),
      addEntry: vi.fn().mockReturnValue(of(mockPlan)),
      removeEntry: vi.fn().mockReturnValue(of({ ...mockPlan, entries: [] })),
      confirmCooked: vi.fn().mockReturnValue(of(undefined)),
    };

    const mockRecipeService = {
      getAll: vi.fn().mockReturnValue(of([
        { id: 'r1', name: 'Pancakes', servings: 4, prepTime: 10, cookTime: 15, difficulty: 'easy', tags: [], ingredients: [], instructions: [], description: '' },
      ])),
    };

    await TestBed.configureTestingModule({
      imports: [MealPlanGridComponent],
      providers: [
        { provide: MealPlanService, useValue: mockMealPlanService },
        { provide: RecipeService, useValue: mockRecipeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPlanGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render 7 day columns', () => {
    const headers = fixture.nativeElement.querySelectorAll('thead th');
    // 1 for meal label + 7 for days
    expect(headers.length).toBe(8);
  });

  it('should render 4 meal rows', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
  });

  it('should show recipe name in assigned slot', () => {
    const content = fixture.nativeElement.querySelector('.meal-cell__name');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('Pancakes');
  });

  it('should show add buttons for empty slots', () => {
    const addBtns = fixture.nativeElement.querySelectorAll('.meal-cell__add');
    expect(addBtns.length).toBeGreaterThan(0);
  });
});
