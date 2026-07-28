import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RecipeService } from './recipe.service';
import { Recipe } from '../../shared/models/recipe.model';
import { Unit } from '../../shared/enums/unit.enum';
import { Difficulty } from '../../shared/enums/difficulty.enum';
import { PantryCategory } from '../../shared/enums/pantry-category.enum';

describe('RecipeService', () => {
  let service: RecipeService;
  let httpTesting: HttpTestingController;

  const mockRecipe: Recipe = {
    id: 'recipe-1',
    name: 'Pancakes',
    description: 'Fluffy breakfast pancakes',
    servings: 4,
    instructions: ['Mix dry ingredients', 'Add wet ingredients', 'Cook on griddle'],
    ingredients: [
      { name: 'Flour', quantity: 200, unit: Unit.G, pantryCategory: PantryCategory.BAKING },
      { name: 'Milk', quantity: 300, unit: Unit.ML, pantryCategory: PantryCategory.DAIRY },
    ],
    prepTime: 10,
    cookTime: 15,
    difficulty: Difficulty.EASY,
    tags: ['breakfast', 'quick'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RecipeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('getAll should call GET /api/recipes', () => {
    service.getAll().subscribe((recipes) => {
      expect(recipes).toEqual([mockRecipe]);
    });

    const req = httpTesting.expectOne('/api/recipes?offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [mockRecipe], meta: { total: 1, limit: 100, offset: 0, hasMore: false } });
  });

  it('getAll follows hasMore until every page is loaded', () => {
    // The API paginates. Stopping at the first page would silently hide every
    // recipe past the limit and read as a sorting bug, not a missing fetch.
    const second = { ...mockRecipe, id: 'recipe-2', name: 'Second' };
    let received: unknown[] = [];
    service.getAll().subscribe((recipes) => {
      received = recipes;
    });

    httpTesting
      .expectOne('/api/recipes?offset=0')
      .flush({ data: [mockRecipe], meta: { total: 2, limit: 1, offset: 0, hasMore: true } });
    httpTesting
      .expectOne('/api/recipes?offset=1')
      .flush({ data: [second], meta: { total: 2, limit: 1, offset: 1, hasMore: false } });

    expect(received).toEqual([mockRecipe, second]);
  });

  it('getAll stops on an empty page rather than looping forever', () => {
    // A server reporting hasMore while returning no rows would leave the offset
    // standing still and spin requests until the tab died.
    let completed = false;
    let received: unknown[] | null = null;
    service.getAll().subscribe({
      next: (recipes) => (received = recipes),
      complete: () => (completed = true),
    });

    httpTesting
      .expectOne('/api/recipes?offset=0')
      .flush({ data: [], meta: { total: 9, limit: 100, offset: 0, hasMore: true } });

    // Completion is the real assertion. Without it the test passes even when the
    // loop never terminates, because reduce simply never emits.
    expect(completed).toBe(true);
    expect(received).toEqual([]);
    httpTesting.verify();
  });

  it('getAll survives a bare-array response from an older API', () => {
    // The reverse of the incident: a client that expects the envelope must not
    // crash if it meets a server that has not been migrated, or has rolled back.
    let received: unknown[] | null = null;
    let completed = false;
    service.getAll().subscribe({
      next: (recipes) => (received = recipes),
      complete: () => (completed = true),
    });

    httpTesting.expectOne('/api/recipes?offset=0').flush([mockRecipe]);

    expect(completed).toBe(true);
    expect(received).toEqual([mockRecipe]);
  });

  it('getById should call GET /api/recipes/:id', () => {
    service.getById('recipe-1').subscribe((recipe) => {
      expect(recipe).toEqual(mockRecipe);
    });

    const req = httpTesting.expectOne('/api/recipes/recipe-1');
    expect(req.request.method).toBe('GET');
    req.flush(mockRecipe);
  });

  it('create should call POST /api/recipes with body', () => {
    const { id, ...payload } = mockRecipe;

    service.create(payload).subscribe((recipe) => {
      expect(recipe).toEqual(mockRecipe);
    });

    const req = httpTesting.expectOne('/api/recipes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockRecipe);
  });

  it('update should call PATCH /api/recipes/:id with body', () => {
    const payload = { name: 'Blueberry Pancakes' };

    service.update('recipe-1', payload).subscribe((recipe) => {
      expect(recipe.name).toBe('Blueberry Pancakes');
    });

    const req = httpTesting.expectOne('/api/recipes/recipe-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...mockRecipe, name: 'Blueberry Pancakes' });
  });

  it('delete should call DELETE /api/recipes/:id', () => {
    service.delete('recipe-1').subscribe();

    const req = httpTesting.expectOne('/api/recipes/recipe-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
