import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { RecipeDetailComponent } from './recipe-detail';
import { AuthService } from '../../../shared/services/auth.service';

/**
 * #77 and #78 — choosing how to cook it.
 *
 * The choice re-FETCHES rather than filtering here. The server owns what a
 * variation means, so a page that resolved overrides itself would be a second
 * implementation to disagree with the shopping list.
 */
describe('RecipeDetailComponent — ways to cook this', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<RecipeDetailComponent>>;
  let httpTesting: HttpTestingController;

  const recipe = (over: Record<string, unknown> = {}) => ({
    id: 'r-ciabatta',
    name: 'No-Knead Ciabatta',
    description: 'Bread',
    servings: 1,
    instructions: ['Stir the yeast in'],
    instructionImages: [],
    ingredients: [
      { name: 'Fresh Yeast', quantity: 1, unit: 'g', pantryCategory: 'baking' },
    ],
    prepTime: 740,
    cookTime: 18,
    difficulty: 'easy',
    tags: [],
    variations: [
      { id: 'v-10g', name: '10 g yeast — same day', note: 'Two to four hours.' },
    ],
    ...over,
  });

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const flushInitial = () => {
    httpTesting
      .match((r) => r.url.includes('/api/recipes/r-ciabatta'))
      .forEach((r) => r.flush(recipe()));
    httpTesting.match(() => true).forEach((r) => r.flush({}));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RecipeDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'r-ciabatta' } } },
        },
        {
          // The shopping-list button only renders for a signed-in cook, so an
          // anonymous fixture cannot reach the thing under test at all.
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            checkAuth: () => of(true),
            localUserId: () => 'u1',
          },
        },
      ],
    });
    fixture = TestBed.createComponent(RecipeDetailComponent);
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushInitial();
  });

  it('offers the recipe as written alongside every variation', () => {
    const choices = Array.from(
      host().querySelectorAll<HTMLElement>('.recipe-variations__choice'),
    ).map((el) => el.textContent?.trim());

    expect(choices).toEqual(['As written', '10 g yeast — same day']);
  });

  it('starts on the recipe as written', () => {
    const on = host().querySelector('.recipe-variations__choice--on');
    expect(on?.textContent?.trim()).toBe('As written');
    expect(host().querySelector('.recipe-variations__note')).toBeNull();
  });

  it('asks the server for the chosen variation rather than resolving it here', () => {
    const choices = host().querySelectorAll<HTMLButtonElement>(
      '.recipe-variations__choice',
    );
    choices[1].click();

    const request = httpTesting.expectOne(
      (r) => r.url.includes('/api/recipes/r-ciabatta') && r.url.includes('variation=v-10g'),
    );
    request.flush(
      recipe({
        variationId: 'v-10g',
        prepTime: 180,
        ingredients: [
          { name: 'Fresh Yeast', quantity: 10, unit: 'g', pantryCategory: 'baking' },
          { name: 'Sugar', quantity: 8, unit: 'g', pantryCategory: 'baking' },
        ],
      }),
    );
    fixture.detectChanges();

    // The reason it exists, which is the part a second recipe could not carry.
    expect(host().querySelector('.recipe-variations__note')?.textContent).toContain(
      'Two to four hours',
    );
    expect(host().textContent).toContain('Sugar');
  });

  it('shops for the variation on screen, not for the recipe as written', () => {
    // The list is built from the recipe the server resolves, so the variation
    // id has to reach it. Without it the teriyaki's garlic — which is in NO base
    // ingredient list — cannot appear on the list at all, which is exactly what
    // #77 and #78 were reported about.
    const choices = host().querySelectorAll<HTMLButtonElement>(
      '.recipe-variations__choice',
    );
    choices[1].click();
    httpTesting
      .expectOne((r) => r.url.includes('variation=v-10g'))
      .flush(recipe({ variationId: 'v-10g' }));
    fixture.detectChanges();

    const button = Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Add to Shopping List',
    );
    button!.click();

    const generated = httpTesting.expectOne((r) =>
      r.url.includes('/from-recipe/r-ciabatta'),
    );
    expect(generated.request.urlWithParams).toContain('variation=v-10g');
  });

  it('shops for the recipe as written when nothing was chosen', () => {
    // The distractor: sending whatever id happens to be lying around would pass
    // the test above and quietly change what the plain button buys.
    const button = Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Add to Shopping List',
    );
    button!.click();

    const generated = httpTesting.expectOne((r) =>
      r.url.includes('/from-recipe/r-ciabatta'),
    );
    expect(generated.request.urlWithParams).not.toContain('variation=');
  });
});
