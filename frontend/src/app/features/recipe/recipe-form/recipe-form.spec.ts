import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { RecipeFormComponent } from './recipe-form';
import { VariationsEditorComponent } from './variations-editor/variations-editor';
import { RecipeService } from '../recipe.service';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { FILTER_TAGS } from '../recipe-tags';

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

  it('tells an author of a NEW recipe to save it first', () => {
    // A variation points at step and ingredient ids, and a recipe that has not
    // been saved has none. Offering the editor here would let somebody write
    // overrides that could name nothing.
    expect(fixture.nativeElement.querySelector('app-variations-editor')).toBeNull();
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

/**
 * Saving a recipe that has variations.
 *
 * Two writes, with different rules, and the order matters: the recipe first, so
 * its steps and ingredients exist to be pointed at, then the variations. The
 * second one only happens when somebody actually opened the panel — the ciabatta
 * must survive an author who came to fix a typo.
 */
describe('RecipeFormComponent — a recipe that has variations', () => {
  let fixture: ComponentFixture<RecipeFormComponent>;
  let component: RecipeFormComponent;
  let recipeService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    getTranslations: ReturnType<typeof vi.fn>;
    getVariationsForAuthoring: ReturnType<typeof vi.fn>;
    replaceVariations: ReturnType<typeof vi.fn>;
  };

  const savedRecipe = {
    id: 'r1',
    steps: [
      { id: 's0', text: 'Stir', imageUrl: null },
      { id: 's1', text: 'Bake', imageUrl: null },
    ],
    ingredients: [
      { id: 'i-yeast', name: 'Fresh Yeast', quantity: 1, unit: 'g', pantryCategory: 'baking' },
    ],
  };

  const authoring = {
    baseIngredients: [
      {
        id: 'i-yeast',
        quantity: 1,
        unit: 'g',
        pantryCategory: 'baking',
        names: [{ locale: 'en', name: 'Fresh Yeast' }],
      },
    ],
    baseSteps: [
      { id: 's0', texts: [{ locale: 'en', text: 'Stir' }] },
      { id: 's1', texts: [{ locale: 'en', text: 'Bake' }] },
    ],
    variations: [
      {
        id: 'v1',
        sortOrder: 0,
        prepTime: 180,
        cookTime: null,
        texts: [{ locale: 'en', name: '10 g yeast', note: 'Quick.' }],
        ingredients: [
          {
            ingredientId: 'i-yeast',
            removed: false,
            quantity: 10,
            unit: null,
            pantryCategory: null,
            sortOrder: 0,
            names: [],
          },
        ],
        steps: [
          {
            stepId: 's0',
            removed: false,
            afterPosition: null,
            texts: [{ locale: 'en', text: 'Stir the sugar in too' }],
          },
        ],
      },
    ],
  };

  const editor = (): VariationsEditorComponent =>
    fixture.debugElement.query(By.directive(VariationsEditorComponent))
      .componentInstance as VariationsEditorComponent;

  /** A real submit, because a method call says nothing about the template reaching it. */
  const submit = (): void => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    recipeService = {
      create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
      update: vi.fn().mockReturnValue(of(savedRecipe)),
      getById: vi.fn().mockReturnValue(
        of({
          ...savedRecipe,
          name: 'Ciabatta',
          description: 'Bread',
          servings: 2,
          prepTime: 740,
          cookTime: 30,
          difficulty: Difficulty.EASY,
          tags: [],
          instructions: ['Stir', 'Bake'],
        }),
      ),
      getTranslations: vi.fn().mockReturnValue(
        of([
          {
            locale: 'en',
            name: 'Ciabatta',
            description: 'Bread',
            instructions: ['Stir', 'Bake'],
            ingredientNames: ['Fresh Yeast'],
          },
        ]),
      ),
      getVariationsForAuthoring: vi.fn().mockReturnValue(of(authoring)),
      replaceVariations: vi.fn().mockReturnValue(of(savedRecipe)),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeFormComponent],
      providers: [
        provideRouter([{ path: 'recipes', component: DummyComponent }]),
        { provide: RecipeService, useValue: recipeService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'r1' } } },
        },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(RecipeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('puts the variations editor on the page when editing', () => {
    // Calling a component method says nothing about whether the template can
    // reach it. This is the template.
    expect(fixture.nativeElement.querySelector('app-variations-editor')).toBeTruthy();
  });

  it('shows no editor at all when the variations could not be read', () => {
    // "No variations" and "we could not find out" look identical in an empty
    // panel, and only one of them is safe to save: an empty set DELETES them.
    recipeService.getVariationsForAuthoring.mockReturnValue(throwError(() => new Error('down')));
    const retry = TestBed.createComponent(RecipeFormComponent);
    retry.detectChanges();

    expect(retry.nativeElement.querySelector('app-variations-editor')).toBeNull();
  });

  it('sends the ingredient ids it loaded, so an edit keeps the overrides', () => {
    // Without these the server deletes and recreates the ingredient rows, and
    // that FK cascade takes every "10 g of yeast" with it.
    submit();

    expect(recipeService.update).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        ingredients: [expect.objectContaining({ id: 'i-yeast' })],
      }),
      expect.anything(),
    );
  });

  it('does not touch the variations when the author did not', () => {
    // The safest round trip is the one that never happens: an author fixing a
    // typo must not rewrite four working variations on the way past.
    submit();

    expect(recipeService.update).toHaveBeenCalled();
    expect(recipeService.replaceVariations).not.toHaveBeenCalled();
  });

  it('saves the variations after the recipe, once the panel has been used', () => {
    editor().skipStep(editor().variations()[0].key, 's1');
    fixture.detectChanges();

    submit();

    expect(recipeService.replaceVariations).toHaveBeenCalled();
    expect(recipeService.update.mock.invocationCallOrder[0]).toBeLessThan(
      recipeService.replaceVariations.mock.invocationCallOrder[0],
    );
  });

  it('sends each variation back with its own id, so a meal plan keeps pointing at it', () => {
    editor().skipStep(editor().variations()[0].key, 's1');
    fixture.detectChanges();

    submit();

    const [, variations] = recipeService.replaceVariations.mock.calls[0] as [
      string,
      { id?: string }[],
    ];
    expect(variations[0].id).toBe('v1');
  });

  it('drops an override pointing at a step the same save removed', () => {
    // The database has already cascaded that row away. Sending its id would be
    // a foreign key that no longer resolves, and the whole save would 500.
    recipeService.update.mockReturnValue(
      of({ ...savedRecipe, steps: [{ id: 's1', text: 'Bake', imageUrl: null }] }),
    );
    editor().setStepText(editor().variations()[0].key, 's0', textEvent('Changed'));
    fixture.detectChanges();

    submit();

    const [, variations] = recipeService.replaceVariations.mock.calls[0] as [
      string,
      { steps?: { stepId?: string }[] }[],
    ];
    expect(variations[0].steps?.map((s) => s.stepId)).not.toContain('s0');
  });

  it('says so when the recipe saved and its variations did not', () => {
    // A partial save that navigates away looks exactly like a whole one.
    recipeService.replaceVariations.mockReturnValue(throwError(() => new Error('nope')));
    editor().skipStep(editor().variations()[0].key, 's1');
    fixture.detectChanges();

    submit();

    expect(component.variationsBlocked()).toBe(true);
  });
});

function textEvent(value: string): Event {
  const input = document.createElement('textarea');
  input.value = value;
  const event = new Event('input');
  Object.defineProperty(event, 'target', { value: input });
  return event;
}

/**
 * #83 — "the create button keeps being greyed out. I have added both danish and
 * english versions".
 *
 * Ingredient names are per-language, and nothing said so. Switching the
 * authoring tab loads that language's names, which for a new recipe are empty;
 * those controls are required, so the form is invalid — while the tab markers,
 * which only ever inspected the recipe's NAME, reported both languages complete.
 * A disabled button, no error anywhere, and a reporter who had in fact filled in
 * everything they were shown.
 */
describe('RecipeFormComponent — the half-translated ingredient list', () => {
  let fixture: ComponentFixture<RecipeFormComponent>;
  let component: RecipeFormComponent;

  /** Everything the form asks for, in whichever language is on screen. */
  const fillCurrentLanguage = (suffix: string): void => {
    component.form.patchValue({
      name: `Test ${suffix}`,
      description: `Description ${suffix}`,
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      difficulty: Difficulty.EASY,
      instructions: `Step one ${suffix}`,
    });
    component.ingredientsArray.at(0).patchValue({
      name: `Flour ${suffix}`,
      quantity: 200,
      unit: 'g',
      pantryCategory: 'baking',
    });
    fixture.detectChanges();
  };

  const other = (): 'en' | 'da' => (component.editingLocale() === 'en' ? 'da' : 'en');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeFormComponent],
      providers: [
        provideRouter([{ path: 'recipes', component: DummyComponent }]),
        {
          provide: RecipeService,
          useValue: {
            create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
            update: vi.fn().mockReturnValue(of({ id: 'r1' })),
            getById: vi.fn(),
            getTranslations: vi.fn().mockReturnValue(of([])),
            getVariationsForAuthoring: vi.fn().mockReturnValue(of(null)),
            replaceVariations: vi.fn(),
          },
        },
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

  it('marks a language incomplete when only its ingredient names are missing', () => {
    // The distractor: the old check looked at the recipe name alone, so this
    // language — named, described, with a method, and blocking the save —
    // reported itself finished.
    fillCurrentLanguage('one');
    const second = other();

    component.switchLocale(second);
    component.form.patchValue({ name: 'Anden titel', description: 'x', instructions: 'y' });
    component.onNameInput();
    fixture.detectChanges();

    expect(component.form.invalid).toBe(true);
    expect(component.missingLocales()).toContain(second);
  });

  it('says which row is missing, on the row', () => {
    // A disabled button with no message is the actual bug report. The error has
    // to be attached to the control that is blocking it.
    fillCurrentLanguage('one');
    component.switchLocale(other());
    fixture.detectChanges();

    const rowError = fixture.nativeElement.querySelector('.ingredient-row .error');

    expect(rowError).toBeTruthy();
    expect(rowError.textContent.trim().length).toBeGreaterThan(0);
  });

  it('stays quiet on a form nobody has filled in yet', () => {
    // Guards the other direction: an empty row on a brand-new recipe is not a
    // missing translation, and shouting about it would train people to ignore it.
    const rowError = fixture.nativeElement.querySelector('.ingredient-row .error');

    expect(rowError).toBeNull();
  });

  it('clears the warning once the name is given in this language too', () => {
    fillCurrentLanguage('one');
    component.switchLocale(other());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ingredient-row .error')).toBeTruthy();

    component.ingredientsArray.at(0).patchValue({ name: 'Flour two' });
    component.onNameInput();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ingredient-row .error')).toBeNull();
  });
});

/**
 * Tagging a recipe so it lands in the filters.
 *
 * The facets match a recipe by looking for its tag by name, and that vocabulary
 * only ever existed inside the filter component — the form offered a free-text
 * box and no hint that any particular word was load-bearing. The Birria was
 * tagged "dinner, mexican" and so never appeared under Beef.
 */
describe('RecipeFormComponent — tags the filters actually match', () => {
  let fixture: ComponentFixture<RecipeFormComponent>;
  let component: RecipeFormComponent;

  const chipFor = (value: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`.tag-chip[data-tag="${value}"]`);

  const tags = (): string => component.form.controls.tags.value;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeFormComponent],
      providers: [
        provideRouter([{ path: 'recipes', component: DummyComponent }]),
        {
          provide: RecipeService,
          useValue: {
            create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
            update: vi.fn().mockReturnValue(of({ id: 'r1' })),
            getById: vi.fn(),
            getTranslations: vi.fn().mockReturnValue(of([])),
            getVariationsForAuthoring: vi.fn().mockReturnValue(of(null)),
            replaceVariations: vi.fn(),
          },
        },
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

  it('offers every tag the filters know about', () => {
    for (const option of FILTER_TAGS) {
      expect(chipFor(option.value)).toBeTruthy();
    }
  });

  it('offers Main, so a dish can be SAID to be a main course', () => {
    // The filter used to infer a main dish from the absence of every other
    // course, which left the author with no way to state it. Reported as a
    // defect: the one course everybody wants was the one chip missing.
    expect(chipFor('Main')).toBeTruthy();
  });

  it('writes the main tag when the Main chip is pressed', () => {
    chipFor('Main').click();
    fixture.detectChanges();

    expect(tags()).toContain('main');
  });

  it('writes the tag when a chip is pressed', () => {
    chipFor('Beef').click();
    fixture.detectChanges();

    expect(tags()).toContain('beef');
  });

  it('takes it off again when the chip is pressed twice', () => {
    chipFor('Beef').click();
    fixture.detectChanges();
    chipFor('Beef').click();
    fixture.detectChanges();

    expect(tags()).not.toContain('beef');
  });

  it('keeps the tags the author typed by hand', () => {
    // The distractor: rebuilding the field from the known vocabulary passes
    // every test above and silently deletes "slow-cooked" and "tacos".
    component.form.controls.tags.setValue('slow-cooked, tacos');

    chipFor('Mexican').click();
    fixture.detectChanges();

    expect(tags()).toContain('slow-cooked');
    expect(tags()).toContain('tacos');
    expect(tags()).toContain('mexican');
  });

  it('shows a stored tag as already chosen, whatever its capitalisation', () => {
    // Tags come back from the server lowercased, and the vocabulary is written
    // in title case. Matching them exactly would leave every chip looking unset
    // on an existing recipe.
    component.form.controls.tags.setValue('mexican, dinner');
    fixture.detectChanges();

    expect(chipFor('Mexican').getAttribute('aria-pressed')).toBe('true');
    expect(chipFor('Beef').getAttribute('aria-pressed')).toBe('false');
  });
});
