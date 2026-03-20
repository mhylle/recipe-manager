import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BilkaToGoService } from './bilkatogo.service';

describe('BilkaToGoService', () => {
  let service: BilkaToGoService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BilkaToGoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('login should POST credentials to login endpoint', () => {
    service.login('user@example.com', 'pass123').subscribe((result) => {
      expect(result.sessionId).toBe('sess-abc');
    });

    const req = httpTesting.expectOne('/api/bilkatogo/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com', password: 'pass123' });
    req.flush({ sessionId: 'sess-abc' });
  });

  it('sendToCart should POST shoppingListId and sessionId to send endpoint', () => {
    service.sendToCart('sl-1', 'sess-abc').subscribe((result) => {
      expect(result.matched.length).toBe(1);
    });

    const req = httpTesting.expectOne('/api/bilkatogo/send');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ shoppingListId: 'sl-1', sessionId: 'sess-abc' });
    req.flush({
      matched: [
        {
          itemName: 'Milk',
          quantity: 1,
          unit: 'L',
          product: {
            objectID: 'p1',
            name: 'Milk 1L',
            productName: 'Whole Milk',
            brand: 'Arla',
            price: 1295,
            units: 1,
            netcontent: '1L',
            isInStock: 1,
          },
        },
      ],
      unmatched: [],
      cartUrl: 'https://bilkatogo.dk/cart/123',
    });
  });
});
