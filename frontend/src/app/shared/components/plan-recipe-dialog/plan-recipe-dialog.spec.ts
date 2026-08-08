import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanRecipeDialogComponent } from './plan-recipe-dialog';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { MealType } from '../../enums/meal-type.enum';
import { Difficulty } from '../../enums/difficulty.enum';
import type { Recipe } from '../../models/recipe.model';
import type { MealPlan } from '../../models/meal-plan.model';

const RECIPE: Recipe = {
  id: 'r-cheesecake',
  name: 'Lime Cheesecake',
  description: 'Chilled',
  servings: 8,
  instructions: ['Chill'],
  ingredients: [],
  prepTime: 20,
  cookTime: 0,
  difficulty: Difficulty.EASY,
  tags: [],
};

/** Tuesday dinner is taken by Lasagne, at index 1. */
const PLAN: MealPlan = {
  id: 'plan-1',
  weekStartDate: '2026-08-03',
  entries: [
    { day: DayOfWeek.MONDAY, meal: MealType.LUNCH, recipeId: 'r-soup', servings: 2 },
    { day: DayOfWeek.TUESDAY, meal: MealType.DINNER, recipeId: 'r-lasagne', servings: 4 },
  ],
};

const RECIPES = [
  RECIPE,
  { ...RECIPE, id: 'r-lasagne', name: 'Lasagne' },
  { ...RECIPE, id: 'r-soup', name: 'Soup' },
];

describe('PlanRecipeDialogComponent', () => {
  let fixture: ComponentFixture<PlanRecipeDialogComponent>;
  let component: PlanRecipeDialogComponent;
  let httpTesting: HttpTestingController;

  const build = () => {
    fixture = TestBed.createComponent(PlanRecipeDialogComponent);
    fixture.componentRef.setInput('recipe', RECIPE);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** Answer the two GETs the constructor fires. */
  const flushLoad = (plan: MealPlan | null = PLAN) => {
    const planReq = httpTesting.expectOne((r) => r.url.includes('/api/meal-plans/week'));
    if (plan) {
      planReq.flush(plan);
    } else {
      planReq.flush({}, { status: 403, statusText: 'Forbidden' });
    }
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/recipes') || r.url.includes('/api/recipes?'))
      .flush({ data: RECIPES, meta: { total: 3, limit: 100, offset: 0, hasMore: false } });
    fixture.detectChanges();
  };

  const post = () =>
    httpTesting.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/api/meal-plans/plan-1/entries'),
    );

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlanRecipeDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('an empty slot', () => {
    it('plans straight away, with no question asked', () => {
      build();
      flushLoad();

      component.chooseSlot(DayOfWeek.WEDNESDAY, MealType.DINNER);

      const req = post();
      expect(req.request.body).toEqual({
        day: DayOfWeek.WEDNESDAY,
        meal: MealType.DINNER,
        recipeId: 'r-cheesecake',
        servings: 8,
      });
      req.flush(PLAN);
    });

    it('uses the recipe’s own servings', () => {
      build();
      flushLoad();

      component.chooseSlot(DayOfWeek.WEDNESDAY, MealType.DINNER);

      const req = post();
      expect((req.request.body as { servings: number }).servings).toBe(8);
      req.flush(PLAN);
    });
  });

  describe('a slot that already holds a meal', () => {
    it('asks instead of planning', () => {
      // A slot may hold more than one meal, so this is a question, not an error.
      build();
      flushLoad();

      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);

      expect(component.step()).toBe('conflict');
      expect(component.conflict()?.name).toBe('Lasagne');
      httpTesting.expectNone((r) => r.method === 'POST');
    });

    it('keeps both when asked to', () => {
      build();
      flushLoad();
      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);

      component.addAlongside();

      const req = post();
      expect(req.request.body).not.toHaveProperty('displace');
      req.flush(PLAN);
    });

    it('names the entry it is replacing, so a shifted index cannot delete the wrong meal', () => {
      // The distractor: sending only the index would pass this test's happy
      // path and silently delete a housemate's dinner when the plan has moved.
      build();
      flushLoad();
      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);

      component.replace();

      const req = post();
      expect((req.request.body as { displace: unknown }).displace).toEqual({
        index: 1,
        expectRecipeId: 'r-lasagne',
      });
      req.flush(PLAN);
    });

    it('moves the displaced meal to the slot that is then chosen', () => {
      build();
      flushLoad();
      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);

      component.startMove();
      expect(component.step()).toBe('moveTarget');
      component.chooseMoveTarget(DayOfWeek.THURSDAY, MealType.LUNCH);

      const req = post();
      expect((req.request.body as { displace: unknown }).displace).toEqual({
        index: 1,
        expectRecipeId: 'r-lasagne',
        to: { day: DayOfWeek.THURSDAY, meal: MealType.LUNCH },
      });
      req.flush(PLAN);
    });

    it('will not move the displaced meal into the slot being planned', () => {
      // That would either undo the displacement or double-book it, depending on
      // write order. The button is disabled; this pins the handler too.
      build();
      flushLoad();
      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);
      component.startMove();

      component.chooseMoveTarget(DayOfWeek.TUESDAY, MealType.DINNER);

      httpTesting.expectNone((r) => r.method === 'POST');
    });
  });

  describe('reading the week', () => {
    it('reports what is in a slot, with its API index', () => {
      build();
      flushLoad();

      const taken = component.occupants(DayOfWeek.TUESDAY, MealType.DINNER);

      expect(taken).toHaveLength(1);
      expect(taken[0].index).toBe(1);
      expect(taken[0].name).toBe('Lasagne');
    });

    it('reports an untouched slot as free', () => {
      build();
      flushLoad();

      expect(component.isTaken(DayOfWeek.SUNDAY, MealType.BREAKFAST)).toBe(false);
    });
  });

  describe('when things go wrong', () => {
    it('says so when there is no kitchen to plan in', () => {
      build();
      flushLoad(null);

      expect(component.error()).toBe('plan.errNoKitchen');
    });

    it('reads 409 as the plan having moved underneath', () => {
      build();
      flushLoad();
      component.chooseSlot(DayOfWeek.TUESDAY, MealType.DINNER);
      component.replace();

      post().flush({}, { status: 409, statusText: 'Conflict' });

      expect(component.error()).toBe('plan.errStale');
      expect(component.step()).toBe('slot');
    });

    it('emits nothing when the request fails', () => {
      const emitted: MealPlan[] = [];
      build();
      flushLoad();
      component.planned.subscribe((p) => emitted.push(p));
      component.chooseSlot(DayOfWeek.WEDNESDAY, MealType.DINNER);

      post().flush({}, { status: 500, statusText: 'Server Error' });

      expect(emitted).toEqual([]);
      expect(component.error()).toBe('plan.errFailed');
    });
  });

  describe('reporting the result', () => {
    it('emits the updated plan once, and not a cancel as well', () => {
      const emitted: MealPlan[] = [];
      let cancels = 0;
      build();
      flushLoad();
      component.planned.subscribe((p) => emitted.push(p));
      component.cancelled.subscribe(() => (cancels += 1));

      component.chooseSlot(DayOfWeek.WEDNESDAY, MealType.DINNER);
      post().flush(PLAN);
      // What the browser raises after close(), and what the template binds.
      component.cancel();

      expect(emitted).toHaveLength(1);
      expect(cancels).toBe(0);
    });
  });
});
