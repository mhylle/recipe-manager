import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { PantryListComponent } from './pantry-list';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';
import { Unit } from '../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

describe('PantryListComponent', () => {
  let fixture: ComponentFixture<PantryListComponent>;
  let component: PantryListComponent;
  let mockPantryService: { getAll: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  const mockItems: PantryItem[] = [
    {
      id: 'test-1',
      name: 'Flour',
      quantity: 500,
      unit: Unit.G,
      category: PantryCategory.BAKING,
      addedDate: '2026-03-19T10:00:00.000Z',
      lastUpdated: '2026-03-19T10:00:00.000Z',
    },
    {
      id: 'test-2',
      name: 'Milk',
      quantity: 1,
      unit: Unit.L,
      category: PantryCategory.DAIRY,
      addedDate: '2026-03-19T10:00:00.000Z',
      lastUpdated: '2026-03-19T10:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    mockPantryService = {
      getAll: vi.fn().mockReturnValue(of(mockItems)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [PantryListComponent],
      providers: [
        provideRouter([]),
        { provide: PantryService, useValue: mockPantryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PantryListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render list of items', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Flour');
    expect(rows[1].textContent).toContain('Milk');
  });

  it('should show empty state when no items', async () => {
    mockPantryService.getAll.mockReturnValue(of([]));
    component.ngOnInit();
    fixture.detectChanges();

    const emptyMessage = fixture.nativeElement.querySelector('.pantry-list__empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toContain('No pantry items yet');
  });

  it('should call delete service when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    component.onDelete(mockItems[0]);

    expect(mockPantryService.delete).toHaveBeenCalledWith('test-1');
  });

  it('should not call delete service when cancelled', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    component.onDelete(mockItems[0]);

    expect(mockPantryService.delete).not.toHaveBeenCalled();
  });
});
