import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingListService } from './shopping-list.service';

describe('ShoppingListService', () => {
  let service: ShoppingListService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ShoppingListService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('generate should POST to generate endpoint', () => {
    service.generate('plan-1').subscribe();
    const req = httpTesting.expectOne('/api/shopping-lists/generate/plan-1');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'sl-1', mealPlanId: 'plan-1', generatedDate: '', items: [] });
  });

  it('getById should call GET', () => {
    service.getById('sl-1').subscribe();
    const req = httpTesting.expectOne('/api/shopping-lists/sl-1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'sl-1', mealPlanId: 'plan-1', generatedDate: '', items: [] });
  });

  it('toggleItem should PATCH item by index', () => {
    service.toggleItem('sl-1', 0).subscribe();
    const req = httpTesting.expectOne('/api/shopping-lists/sl-1/items/0');
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'sl-1', mealPlanId: 'plan-1', generatedDate: '', items: [] });
  });
});
