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

/**
 * #79 — one line per ingredient, not one per unit.
 *
 * The generator now adds up everything that measures the same kind of thing, so
 * what reaches the list is at most one row per ingredient per KIND: 2 onions and
 * 80 g of onion cannot honestly become one number. They can still be one LINE,
 * which is what was actually asked for — "1 list item of white onion".
 */
describe('ShoppingListViewComponent — one line per ingredient', () => {
  let fixture: ComponentFixture<ShoppingListViewComponent>;
  let component: ShoppingListViewComponent;
  let service: { toggleItem: ReturnType<typeof vi.fn> };

  const splitList = {
    id: 'sl-1',
    mealPlanId: 'plan-1',
    generatedDate: '2026-03-19T12:00:00.000Z',
    items: [
      { name: 'White Onion', quantity: 2, unit: Unit.PIECE, checked: false },
      { name: 'Garlic', quantity: 3, unit: Unit.PIECE, checked: false },
      { name: 'White Onion', quantity: 80, unit: Unit.G, checked: false },
    ],
  };

  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.shopping-list__item'));

  const build = async (list: typeof splitList) => {
    service = { toggleItem: vi.fn().mockReturnValue(of(list)) };
    await TestBed.configureTestingModule({
      imports: [ShoppingListViewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ShoppingListService,
          useValue: {
            ...service,
            generate: vi.fn().mockReturnValue(of(list)),
            getById: vi.fn().mockReturnValue(of(list)),
            current: vi.fn().mockReturnValue(of(list)),
            archive: vi.fn().mockReturnValue(of({ ...list, items: [] })),
          },
        },
        {
          provide: MealPlanService,
          useValue: {
            getByWeek: vi.fn().mockReturnValue(
              of({ id: 'plan-1', weekStartDate: '2026-03-16', entries: [] }),
            ),
          },
        },
        {
          provide: BilkaToGoService,
          useValue: {
            login: vi.fn().mockReturnValue(of({ sessionId: 's' })),
            sendToCart: vi.fn().mockReturnValue(of({ matched: [], unmatched: [], cartUrl: '' })),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await build(splitList);
  });

  it('shows the onion once, however many ways it was measured', () => {
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('White Onion');
    expect(rows()[0].textContent).not.toContain('Garlic');
  });

  it('shows both amounts on that one line', () => {
    // The alternative — picking one and hiding the other — sends somebody home
    // with two onions when the recipes wanted two AND eighty grams.
    const onion = rows()[0].textContent ?? '';

    expect(onion).toContain('2');
    expect(onion).toContain('80');
  });

  it('keeps the ingredients in the order the list gave them', () => {
    // The onion's second row arrives after the garlic. Grouping must not shuffle
    // the list, or the shelf order the generator produced is lost.
    expect(rows()[1].textContent).toContain('Garlic');
  });

  it('ticks off every part of an ingredient at once', () => {
    // One line, one checkbox. Ticking it while half the onion stays unchecked
    // would leave the list permanently unfinishable.
    const box = rows()[0].querySelector('input[type=checkbox]') as HTMLInputElement;
    box.click();

    expect(service.toggleItem).toHaveBeenCalledTimes(2);
    const indexes = service.toggleItem.mock.calls.map((c) => c[1]);
    expect(indexes).toEqual([0, 2]);
  });

  it('shows a grouped line as done only when all of its parts are', () => {
    const half = {
      ...splitList,
      items: [
        { name: 'White Onion', quantity: 2, unit: Unit.PIECE, checked: true },
        { name: 'White Onion', quantity: 80, unit: Unit.G, checked: false },
      ],
    };

    TestBed.resetTestingModule();
    return build(half).then(() => {
      const box = rows()[0].querySelector('input[type=checkbox]') as HTMLInputElement;
      expect(box.checked).toBe(false);
    });
  });
});
