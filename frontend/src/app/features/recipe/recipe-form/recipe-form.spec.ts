import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { RecipeFormComponent } from './recipe-form';
import { RecipeService } from '../recipe.service';
import { Difficulty } from '../../../shared/enums/difficulty.enum';

@Component({ template: '' })
class DummyComponent {}

describe('RecipeFormComponent', () => {
  let fixture: ComponentFixture<RecipeFormComponent>;
  let component: RecipeFormComponent;
  let router: Router;
  let mockRecipeService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRecipeService = {
      create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
      update: vi.fn().mockReturnValue(of({ id: 'existing-1' })),
      getById: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeFormComponent],
      providers: [
        provideRouter([
          { path: 'recipes', component: DummyComponent },
          { path: 'recipes/new', component: DummyComponent },
        ]),
        { provide: RecipeService, useValue: mockRecipeService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(RecipeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have an invalid form when empty', () => {
    // Remove the default ingredient row to check base validation
    component.ingredientsArray.clear();
    expect(component.form.valid).toBe(false);
  });

  it('should require name field', () => {
    const nameControl = component.form.controls.name;
    expect(nameControl.valid).toBe(false);

    nameControl.setValue('Pancakes');
    expect(nameControl.valid).toBe(true);
  });

  it('should require description', () => {
    const descControl = component.form.controls.description;
    expect(descControl.valid).toBe(false);

    descControl.setValue('Fluffy pancakes');
    expect(descControl.valid).toBe(true);
  });

  it('should validate servings minimum', () => {
    const servingsControl = component.form.controls.servings;

    servingsControl.setValue(0);
    expect(servingsControl.valid).toBe(false);

    servingsControl.setValue(1);
    expect(servingsControl.valid).toBe(true);
  });

  it('should start with one ingredient row', () => {
    expect(component.ingredientsArray.length).toBe(1);
  });

  it('should add ingredient row when addIngredient is called', () => {
    component.addIngredient();
    expect(component.ingredientsArray.length).toBe(2);
  });

  it('should remove ingredient row when removeIngredient is called', () => {
    component.addIngredient();
    expect(component.ingredientsArray.length).toBe(2);

    component.removeIngredient(0);
    expect(component.ingredientsArray.length).toBe(1);
  });

  it('should call create on submit in create mode', () => {
    component.form.patchValue({
      name: 'Pancakes',
      description: 'Fluffy pancakes',
      servings: 4,
      prepTime: 10,
      cookTime: 15,
      difficulty: Difficulty.EASY,
      tags: 'breakfast, quick',
      instructions: 'Mix\nCook',
    });
    // Fill in the first ingredient
    const ing = component.ingredientsArray.at(0);
    ing.patchValue({ name: 'Flour', quantity: 200 });

    component.onSubmit();

    expect(mockRecipeService.create).toHaveBeenCalled();
    expect(mockRecipeService.update).not.toHaveBeenCalled();
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();

    expect(mockRecipeService.create).not.toHaveBeenCalled();
    expect(mockRecipeService.update).not.toHaveBeenCalled();
  });
});
