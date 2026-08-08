import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
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
            // This kitchen has never made one — which is what "initially"
            // means for the tests below.
            current: vi.fn().mockReturnValue(of(null)),
            archive: vi.fn().mockReturnValue(of({ ...mockList, items: [] })),
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

/**
 * #76 — a list you can come back to.
 *
 * The row was always written; nothing could read it back. The only endpoint was
 * by id, and the id was handed out exactly once, to the page that generated it.
 * Walk away and the list was gone from the app while still sitting in the
 * database, which from inside the shop is the same as never having made one.
 */
describe('ShoppingListViewComponent — coming back to the list', () => {
  let fixture: ComponentFixture<ShoppingListViewComponent>;
  let lists: {
    generate: ReturnType<typeof vi.fn>;
    toggleItem: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    current: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
  };

  const saved = {
    id: 'sl-saved',
    mealPlanId: 'plan-1',
    generatedDate: '2026-08-08T09:54:00.000Z',
    items: [{ name: 'Parmesan', quantity: 200, unit: Unit.G, checked: false }],
  };

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const build = async (
    queryId: string | null,
    current: typeof saved | null = saved,
  ) => {
    lists = {
      generate: vi.fn().mockReturnValue(of(saved)),
      toggleItem: vi.fn().mockReturnValue(of(saved)),
      getById: vi.fn().mockReturnValue(of({ ...saved, id: 'sl-linked' })),
      current: vi.fn().mockReturnValue(of(current)),
      archive: vi.fn().mockReturnValue(of({ ...saved, items: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [ShoppingListViewComponent],
      providers: [
        provideRouter([]),
        { provide: ShoppingListService, useValue: lists },
        {
          provide: MealPlanService,
          useValue: {
            getByWeek: vi
              .fn()
              .mockReturnValue(of({ id: 'plan-1', weekStartDate: '2026-08-03', entries: [] })),
          },
        },
        {
          provide: BilkaToGoService,
          useValue: {
            login: vi.fn().mockReturnValue(of({ sessionId: 'sess-abc' })),
            sendToCart: vi.fn().mockReturnValue(of({ matched: [], unmatched: [], cartUrl: '' })),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => queryId } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingListViewComponent);
    fixture.detectChanges();
  };

  it('shows the kitchen’s saved list on arrival, with no id in the URL', async () => {
    await build(null);

    expect(lists.current).toHaveBeenCalled();
    expect(host().querySelectorAll('.shopping-list__item').length).toBe(1);
    expect(host().textContent).toContain('Parmesan');
  });

  it('still honours an explicit list in the URL', async () => {
    // The meal-plan button links straight to the list it just made; that must
    // keep winning over "whatever is current".
    await build('sl-linked');

    expect(lists.getById).toHaveBeenCalledWith('sl-linked');
    expect(lists.current).not.toHaveBeenCalled();
  });

  it('puts the list away and offers a fresh one', async () => {
    await build(null);

    (host().querySelector('.shopping-list__archive') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(lists.archive).toHaveBeenCalledWith('sl-saved');
    expect(host().querySelector('.shopping-list__empty')).toBeTruthy();
    expect(host().querySelectorAll('.shopping-list__item').length).toBe(0);
  });

  it('offers nothing to archive when there is no list', async () => {
    await build(null, null);
    expect(host().querySelector('.shopping-list__archive')).toBeNull();
  });
});
