import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { ShoppingListViewComponent } from './shopping-list-view';
import { ShoppingListService } from '../shopping-list.service';
import { MealPlanService } from '../../meal-plan/meal-plan.service';
import { BilkaToGoService } from '../bilkatogo/bilkatogo.service';
import { Unit } from '../../../shared/enums/unit.enum';

describe('ShoppingListViewComponent', () => {
  let fixture: ComponentFixture<ShoppingListViewComponent>;
  let component: ShoppingListViewComponent;

  const mockList = {
    id: 'sl-1',
    mealPlanId: 'plan-1',
    generatedDate: '2026-03-19T12:00:00.000Z',
    items: [
      { name: 'Soy Sauce', quantity: 30, unit: Unit.ML, checked: false },
      { name: 'Chicken', quantity: 500, unit: Unit.G, checked: true },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShoppingListViewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ShoppingListService,
          useValue: {
            generate: vi.fn().mockReturnValue(of(mockList)),
            toggleItem: vi.fn().mockReturnValue(of(mockList)),
            getById: vi.fn().mockReturnValue(of(mockList)),
          },
        },
        {
          provide: MealPlanService,
          useValue: {
            getByWeek: vi.fn().mockReturnValue(of({ id: 'plan-1', weekStartDate: '2026-03-16', entries: [] })),
          },
        },
        {
          provide: BilkaToGoService,
          useValue: {
            login: vi.fn().mockReturnValue(of({ sessionId: 'sess-abc' })),
            sendToCart: vi.fn().mockReturnValue(of({ matched: [], unmatched: [], cartUrl: '' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show empty state initially', () => {
    const empty = fixture.nativeElement.querySelector('.shopping-list__empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No shopping list generated yet');
  });

  it('should show items after generation', () => {
    component.generateList();
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.shopping-list__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Soy Sauce');
    expect(items[0].textContent).toContain('30');
  });

  it('should show checked items with line-through', () => {
    component.generateList();
    fixture.detectChanges();

    const checkedItem = fixture.nativeElement.querySelector('.shopping-list__item--checked');
    expect(checkedItem).toBeTruthy();
    expect(checkedItem.textContent).toContain('Chicken');
  });
});
