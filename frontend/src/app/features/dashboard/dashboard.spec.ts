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

  it('should surface three inspiration dishes with readiness', () => {
    const dishes = fixture.nativeElement.querySelectorAll('.dish');
    expect(dishes.length).toBeGreaterThan(0);
    expect(dishes.length).toBeLessThanOrEqual(3);

    // The lead dish is what carries the layout's hierarchy.
    expect(fixture.nativeElement.querySelectorAll('.dish--lead').length).toBe(1);

    // Readiness is the point of the section — a suggestion without it is decoration.
    expect(fixture.nativeElement.querySelector('.readiness__text')).toBeTruthy();
  });

  it('shows the three buckets once there is more than the hero can hold', () => {
    // With only one recipe per bucket all three are promoted into the hero, and
    // a section with nothing left to show is omitted rather than claiming "no
    // recipes". Give each bucket a spare so the sections have something to say.
    mockDashboardService.getMatchResults.mockReturnValue(
      of({
        // Four cookable: the hero takes three (its highest tier), one is left over.
        canMakeNow: [
          mockResult.canMakeNow[0],
          { ...mockResult.canMakeNow[0], id: 'x1a', name: 'Spare A1' },
          { ...mockResult.canMakeNow[0], id: 'x1b', name: 'Spare A2' },
          { ...mockResult.canMakeNow[0], id: 'x1c', name: 'Spare A3' },
        ],
        almostCanMake: [
          mockResult.almostCanMake[0],
          { ...mockResult.almostCanMake[0], recipe: { ...mockResult.almostCanMake[0].recipe, id: 'x2', name: 'Spare B' } },
        ],
        missingMany: [mockResult.missingMany[0], { ...mockResult.missingMany[0], id: 'x3', name: 'Spare C' }],
      }),
    );
    component.loadMatchResults();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.dashboard__section').length).toBe(3);
  });

  it('should display can make now recipes', () => {
    // With this small a fixture every recipe is promoted into the hero, so assert
    // it is on the page rather than in one specific block.
    expect(fixture.nativeElement.textContent).toContain('Simple Salad');
  });

  it('should display almost can make recipes with missing ingredients', () => {
    expect(fixture.nativeElement.textContent).toContain('Pasta');
  });

  it('should display missing many recipes', () => {
    expect(fixture.nativeElement.textContent).toContain('Complex Dish');
  });

  it('should not repeat a hero dish in the lists below it', () => {
    const heroNames = Array.from(
      fixture.nativeElement.querySelectorAll('.dish__name'),
    ).map((el) => (el as HTMLElement).textContent!.trim());
    expect(heroNames.length).toBeGreaterThan(0);

    for (const name of heroNames) {
      const belowHero = Array.from(
        fixture.nativeElement.querySelectorAll(
          '.dashboard__card-title, .dashboard__almost-name, .shop-item__name',
        ),
      ).map((el) => (el as HTMLElement).textContent!.trim());
      expect(belowHero).not.toContain(name);
    }
  });

  it('should show empty state when no match results', () => {
    mockDashboardService.getMatchResults.mockReturnValue(of({
      canMakeNow: [],
      almostCanMake: [],
      missingMany: [],
    }));
    component.loadMatchResults();
    fixture.detectChanges();

    // Every bucket is genuinely empty here, so each shows its message — plus the
    // inspiration section's own.
    const emptyMessages = fixture.nativeElement.querySelectorAll('.dashboard__empty');
    expect(emptyMessages.length).toBe(4);
  });
});
