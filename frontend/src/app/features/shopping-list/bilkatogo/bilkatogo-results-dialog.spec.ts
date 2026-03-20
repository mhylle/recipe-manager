import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BilkaToGoResultsDialogComponent } from './bilkatogo-results-dialog';
import { BilkaToGoSendResult } from '../../../shared/models/bilkatogo.model';

describe('BilkaToGoResultsDialogComponent', () => {
  let fixture: ComponentFixture<BilkaToGoResultsDialogComponent>;
  let component: BilkaToGoResultsDialogComponent;

  const mockResult: BilkaToGoSendResult = {
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
      {
        itemName: 'Bread',
        quantity: 1,
        unit: 'pcs',
        product: {
          objectID: 'p2',
          name: 'Rye Bread',
          productName: 'Dark Rye Bread',
          brand: 'Schulstad',
          price: 2450,
          units: 1,
          netcontent: '750g',
          isInStock: 1,
        },
      },
    ],
    unmatched: [
      { itemName: 'Fresh Basil', reason: 'No matching product found' },
    ],
    cartUrl: 'https://bilkatogo.dk/cart/abc123',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BilkaToGoResultsDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BilkaToGoResultsDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('result', mockResult);
    fixture.detectChanges();
  });

  it('should display summary with correct counts', () => {
    const summary = fixture.nativeElement.querySelector('.dialog__summary');
    expect(summary.textContent).toContain('2 of 3 items added to your basket');
  });

  it('should render matched items section', () => {
    const matched = fixture.nativeElement.querySelector('.results-section--matched');
    expect(matched).toBeTruthy();

    const items = matched.querySelectorAll('.results-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Whole Milk');
    expect(items[0].textContent).toContain('Arla');
  });

  it('should format prices as DKK from ore', () => {
    const prices = fixture.nativeElement.querySelectorAll('.results-item__price');
    expect(prices[0].textContent).toContain('12.95');
    expect(prices[1].textContent).toContain('24.50');
  });

  it('should render unmatched items section', () => {
    const unmatched = fixture.nativeElement.querySelector('.results-section--unmatched');
    expect(unmatched).toBeTruthy();

    const items = unmatched.querySelectorAll('.results-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Fresh Basil');
    expect(items[0].textContent).toContain('No matching product found');
  });

  it('should render cart link with correct URL and security attributes', () => {
    const link = fixture.nativeElement.querySelector('a.btn--primary');
    expect(link).toBeTruthy();
    expect(link.href).toBe('https://bilkatogo.dk/cart/abc123');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('should have aria attributes on dialog', () => {
    const backdrop = fixture.nativeElement.querySelector('.dialog-backdrop');
    expect(backdrop.getAttribute('role')).toBe('dialog');
    expect(backdrop.getAttribute('aria-modal')).toBe('true');
  });

  it('should emit closed when close button is clicked', () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);

    const closeBtn = fixture.nativeElement.querySelector('.btn--ghost');
    closeBtn.click();

    expect(spy).toHaveBeenCalled();
  });

  it('should not render matched section when no matched items', async () => {
    fixture.componentRef.setInput('result', {
      matched: [],
      unmatched: [{ itemName: 'Milk', reason: 'Out of stock' }],
      cartUrl: '',
    });
    fixture.detectChanges();

    const matched = fixture.nativeElement.querySelector('.results-section--matched');
    expect(matched).toBeFalsy();
  });

  it('should not render unmatched section when no unmatched items', async () => {
    fixture.componentRef.setInput('result', {
      matched: mockResult.matched,
      unmatched: [],
      cartUrl: 'https://bilkatogo.dk/cart/abc123',
    });
    fixture.detectChanges();

    const unmatched = fixture.nativeElement.querySelector('.results-section--unmatched');
    expect(unmatched).toBeFalsy();
  });
});
