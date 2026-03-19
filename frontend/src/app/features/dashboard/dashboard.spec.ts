import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard';
import { DashboardService, MatchResult } from './dashboard.service';
import { Difficulty } from '../../shared/enums/difficulty.enum';
import { Unit } from '../../shared/enums/unit.enum';
import { PantryCategory } from '../../shared/enums/pantry-category.enum';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let mockDashboardService: { getMatchResults: ReturnType<typeof vi.fn> };

  const mockResult: MatchResult = {
    canMakeNow: [
      {
        id: 'r1',
        name: 'Simple Salad',
        description: 'Easy salad',
        servings: 2,
        instructions: ['Mix'],
        ingredients: [{ name: 'Lettuce', quantity: 1, unit: Unit.PIECE, pantryCategory: PantryCategory.PRODUCE }],
        prepTime: 5,
        cookTime: 0,
        difficulty: Difficulty.EASY,
        tags: [],
      },
    ],
    almostCanMake: [
      {
        recipe: {
          id: 'r2',
          name: 'Pasta',
          description: 'Quick pasta',
          servings: 2,
          instructions: ['Cook'],
          ingredients: [],
          prepTime: 5,
          cookTime: 10,
          difficulty: Difficulty.EASY,
          tags: [],
        },
        missingIngredients: [{ name: 'Pasta', required: 200, available: 0, unit: 'g' }],
      },
    ],
    missingMany: [
      {
        id: 'r3',
        name: 'Complex Dish',
        description: 'Hard recipe',
        servings: 4,
        instructions: ['Step 1'],
        ingredients: [],
        prepTime: 30,
        cookTime: 60,
        difficulty: Difficulty.HARD,
        tags: [],
      },
    ],
  };

  beforeEach(async () => {
    mockDashboardService = {
      getMatchResults: vi.fn().mockReturnValue(of(mockResult)),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display three bucket sections', () => {
    const sections = fixture.nativeElement.querySelectorAll('.bucket');
    expect(sections.length).toBe(3);
  });

  it('should display can make now recipes', () => {
    const canMake = fixture.nativeElement.querySelector('.bucket--can-make');
    expect(canMake.textContent).toContain('Can Make Now (1)');
    expect(canMake.textContent).toContain('Simple Salad');
  });

  it('should display almost can make recipes with missing ingredients', () => {
    const almost = fixture.nativeElement.querySelector('.bucket--almost');
    expect(almost.textContent).toContain('Need 1-2 Items (1)');
    expect(almost.textContent).toContain('Pasta');
    expect(almost.textContent).toContain('Missing: Pasta');
  });

  it('should display missing many recipes', () => {
    const missing = fixture.nativeElement.querySelector('.bucket--missing');
    expect(missing.textContent).toContain('Missing Many Items (1)');
    expect(missing.textContent).toContain('Complex Dish');
  });

  it('should show empty state when no match results', () => {
    mockDashboardService.getMatchResults.mockReturnValue(of({
      canMakeNow: [],
      almostCanMake: [],
      missingMany: [],
    }));
    component.ngOnInit();
    fixture.detectChanges();

    const emptyMessages = fixture.nativeElement.querySelectorAll('.bucket__empty');
    expect(emptyMessages.length).toBe(3);
  });
});
