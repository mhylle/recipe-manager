import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
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
