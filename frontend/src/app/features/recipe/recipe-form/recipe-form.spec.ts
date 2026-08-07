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

describe('RecipeFormComponent — keeping a recipe in your kitchen', () => {
  let fixture: ComponentFixture<RecipeFormComponent>;
  let component: RecipeFormComponent;
  let recipeService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn>; getTranslations: ReturnType<typeof vi.fn> };

  /** Enough of a filled form that onSubmit is not short-circuited by validation. */
  function fillRequiredFields(): void {
    component.form.patchValue({
      name: 'Cheesecake',
      description: 'Lime and white chocolate',
      servings: 8,
      prepTime: 20,
      cookTime: 0,
      difficulty: Difficulty.EASY,
      instructions: 'Chill it',
    });
    component.ingredientsArray.at(0).patchValue({
      name: 'Lime',
      quantity: 2,
      unit: 'pcs',
      pantryCategory: 'produce',
    });
  }

  beforeEach(async () => {
    recipeService = {
      create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
      update: vi.fn().mockReturnValue(of({ id: 'existing-1' })),
      getById: vi.fn(),
      getTranslations: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeFormComponent],
      providers: [
        provideRouter([{ path: 'recipes', component: DummyComponent }]),
        { provide: RecipeService, useValue: recipeService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(RecipeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts public, because the shared library is the norm', () => {
    // A recipe nobody expected to be hidden is worse than one nobody expected
    // to be shared: the first looks like the save failed.
    expect(component.form.controls.isPrivate.value).toBe(false);
  });

  it('sends isPrivate false when the author leaves the toggle alone', () => {
    // The distractor: an implementation that never sent the field at all would
    // also "work" here until the backend default changed under it.
    fillRequiredFields();

    component.onSubmit();

    expect(recipeService.create).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivate: false }),
      expect.anything(),
    );
  });

  it('sends isPrivate true once the author ticks the box', () => {
    fillRequiredFields();
    component.form.controls.isPrivate.setValue(true);

    component.onSubmit();

    expect(recipeService.create).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivate: true }),
      expect.anything(),
    );
  });

  it('renders a checkbox the label is wired to', () => {
    // Without the for/id pairing the label is decoration and the control is
    // unreachable by name for anyone using a screen reader.
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#isPrivate');
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label[for="isPrivate"]');

    expect(input).toBeTruthy();
    expect(input.type).toBe('checkbox');
    expect(label).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe('private-hint');
    expect(fixture.nativeElement.querySelector('#private-hint')).toBeTruthy();
  });
});
