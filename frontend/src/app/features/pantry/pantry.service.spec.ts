import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PantryService } from './pantry.service';
import { PantryItem } from '../../shared/models/pantry-item.model';
import { Unit } from '../../shared/enums/unit.enum';
import { PantryCategory } from '../../shared/enums/pantry-category.enum';

describe('PantryService', () => {
  let service: PantryService;
  let httpTesting: HttpTestingController;

  const mockItem: PantryItem = {
    id: 'test-1',
    name: 'Flour',
    quantity: 500,
    unit: Unit.G,
    category: PantryCategory.BAKING,
    addedDate: '2026-03-19T10:00:00.000Z',
    lastUpdated: '2026-03-19T10:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PantryService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('getAll should call GET /api/pantry', () => {
    service.getAll().subscribe((items) => {
      expect(items).toEqual([mockItem]);
    });

    const req = httpTesting.expectOne('/api/pantry');
    expect(req.request.method).toBe('GET');
    req.flush([mockItem]);
  });

  it('getById should call GET /api/pantry/:id', () => {
    service.getById('test-1').subscribe((item) => {
      expect(item).toEqual(mockItem);
    });

    const req = httpTesting.expectOne('/api/pantry/test-1');
    expect(req.request.method).toBe('GET');
    req.flush(mockItem);
  });

  it('create should call POST /api/pantry with body', () => {
    const payload = {
      name: 'Flour',
      quantity: 500,
      unit: Unit.G,
      category: PantryCategory.BAKING,
    };

    service.create(payload).subscribe((item) => {
      expect(item).toEqual(mockItem);
    });

    const req = httpTesting.expectOne('/api/pantry');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockItem);
  });

  it('update should call PATCH /api/pantry/:id with body', () => {
    const payload = { quantity: 250 };

    service.update('test-1', payload).subscribe((item) => {
      expect(item.quantity).toBe(250);
    });

    const req = httpTesting.expectOne('/api/pantry/test-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...mockItem, quantity: 250 });
  });

  it('delete should call DELETE /api/pantry/:id', () => {
    service.delete('test-1').subscribe();

    const req = httpTesting.expectOne('/api/pantry/test-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
