import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { MealPlanGridComponent } from './meal-plan-grid';
import { MealPlanService } from '../meal-plan.service';
import { RecipeService } from '../../recipe/recipe.service';
import { DayOfWeek } from '../../../shared/enums/day-of-week.enum';
import { MealType } from '../../../shared/enums/meal-type.enum';

const recipe = (id: string, name: string) => ({
  id,
  name,
  servings: 4,
  prepTime: 10,
  cookTime: 15,
  difficulty: 'easy',
  tags: [],
  ingredients: [],
  instructions: [],
  description: '',
});

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
      getAll: vi.fn().mockReturnValue(of([recipe('r1', 'Pancakes')])),
    };

    await TestBed.configureTestingModule({
      imports: [MealPlanGridComponent],
      providers: [
        provideRouter([]),
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
    const content = fixture.nativeElement.querySelector('.meal-grid__recipe-name');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('Pancakes');
  });

  it('should show add buttons for empty slots', () => {
    const addBtns = fixture.nativeElement.querySelectorAll('.meal-grid__add-btn');
    expect(addBtns.length).toBeGreaterThan(0);
  });
});

/**
 * A slot may hold several meals on purpose — a large lunch and a small one are
 * both lunch — and the backend has always allowed it. The grid used to resolve a
 * slot with findIndex, so everything after the first was invisible AND
 * unreachable: no remove, no "mark cooked", and no add-chip either, because a
 * free slot was defined as one findIndex missed.
 *
 * The plan below interleaves a Tuesday entry between the two Monday dinners on
 * purpose. Entries are addressed by their position in the WHOLE plan, so a fix
 * that numbered them within the slot would pass a naive test and then delete a
 * housemate's Tuesday lunch when someone removed Monday's second dinner.
 */
describe('MealPlanGridComponent — a slot holding more than one meal', () => {
  let fixture: ComponentFixture<MealPlanGridComponent>;
  let mealPlanService: {
    getByWeek: ReturnType<typeof vi.fn>;
    addEntry: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
    confirmCooked: ReturnType<typeof vi.fn>;
  };

  const plan = {
    id: 'plan-1',
    weekStartDate: '2026-03-16',
    entries: [
      { day: DayOfWeek.MONDAY, meal: MealType.DINNER, recipeId: 'r1', servings: 4 },
      { day: DayOfWeek.TUESDAY, meal: MealType.LUNCH, recipeId: 'r3', servings: 2 },
      { day: DayOfWeek.MONDAY, meal: MealType.DINNER, recipeId: 'r2', servings: 6 },
    ],
  };

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  /** The card for a named recipe, in whichever layout was asked for. */
  const cardFor = (name: string, selector: string): HTMLElement => {
    const card = Array.from(host().querySelectorAll<HTMLElement>(selector)).find((el) =>
      el.textContent?.includes(name),
    );
    expect(card, `no ${selector} for ${name}`).toBeTruthy();
    return card as HTMLElement;
  };

  const namesIn = (selector: string): string[] =>
    Array.from(host().querySelectorAll<HTMLElement>(selector)).map(
      (el) => el.textContent?.trim() ?? '',
    );

  beforeEach(async () => {
    mealPlanService = {
      getByWeek: vi.fn().mockReturnValue(of(plan)),
      addEntry: vi.fn().mockReturnValue(of(plan)),
      removeEntry: vi.fn().mockReturnValue(of(plan)),
      confirmCooked: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [MealPlanGridComponent],
      providers: [
        provideRouter([]),
        { provide: MealPlanService, useValue: mealPlanService },
        {
          provide: RecipeService,
          useValue: {
            getAll: vi
              .fn()
              .mockReturnValue(
                of([recipe('r1', 'Pancakes'), recipe('r2', 'Lasagne'), recipe('r3', 'Soup')]),
              ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPlanGridComponent);
    fixture.detectChanges();
  });

  it('shows every meal in the slot on the desktop grid', () => {
    expect(namesIn('.meal-grid__recipe-name')).toEqual(['Soup', 'Pancakes', 'Lasagne']);
  });

  it('shows every meal in the slot on the phone layout', () => {
    const monday = host().querySelector('.meal-day') as HTMLElement;
    const names = Array.from(monday.querySelectorAll<HTMLElement>('.meal-day__recipe')).map(
      (el) => el.textContent?.trim(),
    );
    expect(names).toEqual(['Pancakes', 'Lasagne']);
  });

  it('keeps an occupied slot open for another meal', () => {
    // Without this the second meal can only ever be added from a recipe page:
    // the grid treated "occupied" as "full" and offered no way in.
    const addMore = fixture.nativeElement.querySelectorAll('.meal-grid__add-more');
    expect(addMore.length).toBe(2); // monday dinner + tuesday lunch
    expect((addMore[0] as HTMLElement).getAttribute('aria-label')).toBe(
      'Add another recipe for Tuesday Lunch',
    );
  });

  it('removes the meal whose button was pressed, by its position in the plan', () => {
    const lasagne = cardFor('Lasagne', '.meal-grid__entry');
    const remove = lasagne.querySelectorAll('button')[1] as HTMLButtonElement;

    remove.click();

    // 2, not 1: Lasagne is the second meal in the slot but the third entry in
    // the plan, and the API addresses entries by their position in the plan.
    expect(mealPlanService.removeEntry).toHaveBeenCalledWith('plan-1', 2);
  });

  it('marks cooked the meal whose button was pressed, by its position in the plan', () => {
    const lasagne = cardFor('Lasagne', '.meal-grid__entry');
    const done = lasagne.querySelectorAll('button')[0] as HTMLButtonElement;

    done.click();

    expect(mealPlanService.confirmCooked).toHaveBeenCalledWith('plan-1', 2);
  });

  it('removes the right meal from the phone layout too', () => {
    const lasagne = cardFor('Lasagne', '.meal-day__entry');
    const remove = lasagne.querySelectorAll('button')[1] as HTMLButtonElement;

    remove.click();

    expect(mealPlanService.removeEntry).toHaveBeenCalledWith('plan-1', 2);
  });
});

/** #70 — the plan says what to cook; it should also take you to how. */
describe('MealPlanGridComponent — opening the recipe from the plan', () => {
  let fixture: ComponentFixture<MealPlanGridComponent>;

  const plan = {
    id: 'plan-1',
    weekStartDate: '2026-03-16',
    entries: [
      { day: DayOfWeek.MONDAY, meal: MealType.DINNER, recipeId: 'r1', servings: 4 },
      { day: DayOfWeek.TUESDAY, meal: MealType.DINNER, recipeId: 'gone', servings: 4 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MealPlanGridComponent],
      providers: [
        provideRouter([]),
        {
          provide: MealPlanService,
          useValue: {
            getByWeek: vi.fn().mockReturnValue(of(plan)),
            addEntry: vi.fn().mockReturnValue(of(plan)),
            removeEntry: vi.fn().mockReturnValue(of(plan)),
            confirmCooked: vi.fn().mockReturnValue(of(undefined)),
          },
        },
        {
          provide: RecipeService,
          useValue: { getAll: vi.fn().mockReturnValue(of([recipe('r1', 'Pancakes')])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPlanGridComponent);
    fixture.detectChanges();
  });

  it('links a planned meal to its recipe, in both layouts', () => {
    const grid = fixture.nativeElement.querySelector(
      'a.meal-grid__recipe-name',
    ) as HTMLAnchorElement;
    const phone = fixture.nativeElement.querySelector(
      'a.meal-day__recipe',
    ) as HTMLAnchorElement;

    expect(grid?.getAttribute('href')).toBe('/recipes/r1');
    expect(phone?.getAttribute('href')).toBe('/recipes/r1');
  });

  it('does not link a recipe it cannot resolve', () => {
    // A deleted recipe, or one in a kitchen you cannot read. Offering a link to
    // a page that will 404 is worse than showing the row as-is.
    const links = fixture.nativeElement.querySelectorAll('a.meal-grid__recipe-name');
    expect(links.length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.meal-grid__recipe-name').length).toBe(2);
  });
});
