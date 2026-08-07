import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pantryContextInterceptor } from './pantry-context.interceptor';
import { PantryContextService } from './pantry-context.service';
import { MealPlanService } from '../../features/meal-plan/meal-plan.service';
import { ShoppingListService } from '../../features/shopping-list/shopping-list.service';
import { PantryService } from '../../features/pantry/pantry.service';
import { StaplesService } from '../../features/staples/staples.service';
import { RecipeService } from '../../features/recipe/recipe.service';

describe('pantryContextInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let context: PantryContextService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([pantryContextInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    context = TestBed.inject(PantryContextService);
  });

  afterEach(() => httpTesting.verify());

  /** Put a kitchen in context without going through the network. */
  const selectKitchen = (id: string) => {
    context.pantries.set([{ id, name: id, role: 'owner', isOwner: true, memberCount: 1 }]);
    context.currentId.set(id);
  };

  const expectParam = (url: string, expected: string | null) => {
    http.get(url).subscribe();
    const req = httpTesting.expectOne((r) => r.url === url);
    expect(req.request.params.get('pantryId')).toBe(expected);
    req.flush({});
  };

  // Every URL below is the real one, taken from the services' baseUrl. The first
  // version of this spec invented '/api/meal-plan' and '/api/shopping-list'
  // (singular), which no controller serves — so it passed while the interceptor
  // skipped both areas entirely.
  describe('kitchen-scoped paths', () => {
    it.each([
      '/api/pantry',
      '/api/pantry/expiring',
      '/api/meal-plans/week',
      '/api/shopping-lists',
      '/api/staples',
      '/api/recipes/match',
      '/api/bilkatogo/search',
    ])('sends the current kitchen on %s', (url) => {
      selectKitchen('p-1');
      expectParam(url, 'p-1');
    });

    it('follows the switcher', () => {
      // The bug this exists to prevent: selecting another kitchen reloaded the
      // views and fetched the same kitchen again, so the switcher did nothing.
      selectKitchen('p-1');
      expectParam('/api/meal-plans/week', 'p-1');

      context.pantries.set([
        { id: 'p-1', name: 'Home', role: 'owner', isOwner: true, memberCount: 2 },
        { id: 'p-2', name: 'Cabin', role: 'member', isOwner: false, memberCount: 3 },
      ]);
      context.select('p-2');

      expectParam('/api/meal-plans/week', 'p-2');
    });
  });

  describe('paths it must leave alone', () => {
    it.each([
      '/api/recipes',
      '/api/recipes/abc-123',
      '/api/pantries',
      '/api/pantries/p-1/members',
      '/api/profile/gemini-key',
      '/api/admin/users',
      '/api/timers',
      '/api/push/key',
      '/api/me',
    ])('sends nothing on %s', (url) => {
      selectKitchen('p-1');
      expectParam(url, null);
    });

    it('does not match a path that merely starts with the same letters', () => {
      // `/api/pantries` must not be caught by the `/api/pantry` prefix: sharing
      // addresses a kitchen by path segment and takes the id from the URL.
      selectKitchen('p-1');
      expectParam('/api/pantries', null);
    });
  });

  describe('when there is nothing to send', () => {
    it('sends nothing before the kitchen list has loaded', () => {
      // Correct on a first load: the backend resolves the default kitchen, which
      // is the right answer when the client does not yet know of any.
      expectParam('/api/pantry', null);
    });

    it('leaves an explicitly supplied id alone', () => {
      // A caller that knows better than the ambient selection must win.
      selectKitchen('p-1');
      http.get('/api/pantry', { params: { pantryId: 'p-explicit' } }).subscribe();

      const req = httpTesting.expectOne((r) => r.url === '/api/pantry');
      expect(req.request.params.get('pantryId')).toBe('p-explicit');
      req.flush({});
    });
  });

  it('preserves other query parameters', () => {
    selectKitchen('p-1');
    http.get('/api/shopping-lists', { params: { servings: '4' } }).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/shopping-lists');
    expect(req.request.params.get('servings')).toBe('4');
    expect(req.request.params.get('pantryId')).toBe('p-1');
    req.flush({});
  });

  describe('production URL shape', () => {
    // environment.apiBase is '' in dev and '/api/recipe-manager' in production,
    // so the deployed paths carry that prefix. Testing only the dev shape is how
    // a matcher that worked everywhere in CI matched nothing in production.
    it.each([
      '/api/recipe-manager/api/pantry',
      '/api/recipe-manager/api/meal-plans/week',
      '/api/recipe-manager/api/shopping-lists',
      '/api/recipe-manager/api/staples',
      '/api/recipe-manager/api/recipes/match',
    ])('sends the current kitchen on %s', (url) => {
      selectKitchen('p-1');
      expectParam(url, 'p-1');
    });

    it.each([
      '/api/recipe-manager/api/recipes',
      '/api/recipe-manager/api/pantries',
      '/api/recipe-manager/api/pantries/p-1/members',
      '/api/recipe-manager/api/me',
    ])('still leaves %s alone', (url) => {
      selectKitchen('p-1');
      expectParam(url, null);
    });
  });

  it('works on an absolute URL', () => {
    selectKitchen('p-1');
    const url = 'https://mhylle.com/api/recipe-manager/api/pantry';
    http.get(url).subscribe();

    const req = httpTesting.expectOne((r) => r.url === url);
    // The path is extracted from the URL, so a deployed base does not defeat it.
    expect(req.request.params.get('pantryId')).toBe('p-1');
    req.flush({});
  });
});

/**
 * The same rule, driven through the REAL services.
 *
 * The block above lists URLs by hand, and the first version of it invented two
 * that no controller serves — so it passed while meal plans and shopping lists
 * were silently skipped. These cases take the URL from the service itself, so an
 * allowlist entry that does not match the code cannot pass.
 */
describe('pantryContextInterceptor — through the real services', () => {
  let httpTesting: HttpTestingController;
  let context: PantryContextService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([pantryContextInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    context = TestBed.inject(PantryContextService);
    context.pantries.set([
      { id: 'p-1', name: 'Home', role: 'owner', isOwner: true, memberCount: 1 },
    ]);
    context.currentId.set('p-1');
  });

  afterEach(() => httpTesting.verify());

  const expectKitchenSent = () => {
    const req = httpTesting.expectOne(() => true);
    expect(req.request.params.get('pantryId')).toBe('p-1');
    req.flush({});
  };

  it('meal plans carry the kitchen', () => {
    TestBed.inject(MealPlanService).getByWeek('2026-08-03').subscribe();
    expectKitchenSent();
  });

  it('shopping lists carry the kitchen', () => {
    TestBed.inject(ShoppingListService).generateFromRecipe('r-1').subscribe();
    expectKitchenSent();
  });

  it('pantry items carry the kitchen', () => {
    TestBed.inject(PantryService).getAll().subscribe();
    expectKitchenSent();
  });

  it('staples carry the kitchen', () => {
    TestBed.inject(StaplesService).getStaples().subscribe();
    expectKitchenSent();
  });

  it('recipes do NOT — the library is shared, not per kitchen', () => {
    TestBed.inject(RecipeService).getAll().subscribe();
    const req = httpTesting.expectOne(() => true);
    expect(req.request.params.get('pantryId')).toBeNull();
    req.flush({ data: [], meta: { total: 0, limit: 0, offset: 0, hasMore: false } });
  });
});
