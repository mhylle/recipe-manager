import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PantryFormComponent } from './pantry-form';
import { PantryService } from '../pantry.service';
import { Unit } from '../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

@Component({ template: '' })
class DummyComponent {}

describe('PantryFormComponent', () => {
  let fixture: ComponentFixture<PantryFormComponent>;
  let component: PantryFormComponent;
  let router: Router;
  let mockPantryService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPantryService = {
      create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
      update: vi.fn().mockReturnValue(of({ id: 'existing-1' })),
      getById: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PantryFormComponent],
      providers: [
        provideRouter([
          { path: 'pantry', component: DummyComponent },
          { path: 'pantry/new', component: DummyComponent },
        ]),
        { provide: PantryService, useValue: mockPantryService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PantryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have an invalid form when empty', () => {
    expect(component.form.valid).toBe(false);
  });

  it('should require name field', () => {
    const nameControl = component.form.controls.name;
    expect(nameControl.valid).toBe(false);

    nameControl.setValue('Flour');
    expect(nameControl.valid).toBe(true);
  });

  it('should require quantity and validate minimum', () => {
    const qtyControl = component.form.controls.quantity;

    qtyControl.setValue(-1);
    expect(qtyControl.valid).toBe(false);

    qtyControl.setValue(0);
    expect(qtyControl.valid).toBe(true);

    qtyControl.setValue(500);
    expect(qtyControl.valid).toBe(true);
  });

  it('should require unit and category', () => {
    expect(component.form.controls.unit.valid).toBe(false);
    expect(component.form.controls.category.valid).toBe(false);

    component.form.controls.unit.setValue(Unit.G);
    component.form.controls.category.setValue(PantryCategory.BAKING);

    expect(component.form.controls.unit.valid).toBe(true);
    expect(component.form.controls.category.valid).toBe(true);
  });

  it('should be valid when all required fields are filled', () => {
    component.form.patchValue({
      name: 'Flour',
      quantity: 500,
      unit: Unit.G,
      category: PantryCategory.BAKING,
    });

    expect(component.form.valid).toBe(true);
  });

  it('should call create on submit in create mode', () => {
    component.form.patchValue({
      name: 'Flour',
      quantity: 500,
      unit: Unit.G,
      category: PantryCategory.BAKING,
    });

    component.onSubmit();

    expect(mockPantryService.create).toHaveBeenCalled();
    expect(mockPantryService.update).not.toHaveBeenCalled();
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();

    expect(mockPantryService.create).not.toHaveBeenCalled();
    expect(mockPantryService.update).not.toHaveBeenCalled();
  });
});

/**
 * #81 — putting something in the pantry by scanning it.
 *
 * The scan fills the form; it does not save anything. Everything it writes is
 * something a person then looks at, because an open database written by the
 * public is right most of the time and confidently wrong the rest.
 */
describe('PantryFormComponent — scanning a barcode', () => {
  let fixture: ComponentFixture<PantryFormComponent>;
  let component: PantryFormComponent;
  let service: { lookupBarcode: ReturnType<typeof vi.fn> };

  const nutella = {
    barcode: '3017620422003',
    name: 'Nutella',
    category: 'condiments',
    quantity: 400,
    unit: 'g',
  };

  const build = async (lookup: unknown) => {
    TestBed.resetTestingModule();
    service = { lookupBarcode: vi.fn().mockReturnValue(of(lookup)) };
    await TestBed.configureTestingModule({
      imports: [PantryFormComponent],
      providers: [
        provideRouter([{ path: 'pantry', component: DummyComponent }]),
        {
          provide: PantryService,
          useValue: {
            ...service,
            create: vi.fn().mockReturnValue(of({ id: 'new-1' })),
            update: vi.fn(),
            getById: vi.fn(),
            getTranslations: vi.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PantryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => build(nutella));

  it('offers the scanner when adding something new', () => {
    expect(fixture.nativeElement.querySelector('app-barcode-scanner')).toBeTruthy();
  });

  it('fills the form from what the database knows', () => {
    component.onScanned('3017620422003');
    fixture.detectChanges();

    expect(component.form.getRawValue()).toMatchObject({
      name: 'Nutella',
      category: 'condiments',
      quantity: 400,
      unit: 'g',
      barcode: '3017620422003',
    });
  });

  it('keeps the number even when nobody has heard of it', async () => {
    // The distractor: bailing out on an unknown code throws away the one piece
    // of information the scan definitely got right. Typed once, the item then
    // carries its barcode for next time.
    await build(null);

    component.onScanned('5701234567890');
    fixture.detectChanges();

    expect(component.form.getRawValue().barcode).toBe('5701234567890');
    expect(component.form.getRawValue().name).toBe('');
    expect(component.scanResult()).toBe('unknown');
  });

  it('does not invent an amount the packaging never gave', async () => {
    // A quantity of 1 that nobody measured is worse than an empty box.
    await build({ ...nutella, quantity: null, unit: null });

    component.onScanned('3017620422003');
    fixture.detectChanges();

    expect(component.form.getRawValue().quantity).toBe(0);
    expect(component.form.getRawValue().name).toBe('Nutella');
  });

  it('says so plainly when the lookup itself fails', async () => {
    await build(null);
    service.lookupBarcode.mockReturnValue(throwError(() => new Error('offline')));

    component.onScanned('3017620422003');
    fixture.detectChanges();

    expect(component.scanResult()).toBe('unknown');
    expect(component.lookingUp()).toBe(false);
  });

  it('saves nothing by itself — a person still presses the button', () => {
    // Scanning fills the form. An open database is confidently wrong often
    // enough that nothing should reach the pantry unlooked at.
    const pantry = TestBed.inject(PantryService) as unknown as {
      create: ReturnType<typeof vi.fn>;
    };

    component.onScanned('3017620422003');
    fixture.detectChanges();

    expect(pantry.create).not.toHaveBeenCalled();
  });
});
