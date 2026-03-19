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

    const req = httpTesting.expectOne('/api/recipes');
    expect(req.request.method).toBe('GET');
    req.flush([mockRecipe]);
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
