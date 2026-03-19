import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { Unit } from '../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

@Component({
  selector: 'app-pantry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pantry-form">
      <h2>{{ isEditMode() ? 'Edit Pantry Item' : 'Add Pantry Item' }}</h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="form-group">
          <label for="name">Name <span aria-hidden="true">*</span></label>
          <input
            id="name"
            type="text"
            formControlName="name"
            [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched"
            aria-required="true"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <p class="error" role="alert">Name is required.</p>
          }
        </div>

        <div class="form-group">
          <label for="quantity">Quantity <span aria-hidden="true">*</span></label>
          <input
            id="quantity"
            type="number"
            formControlName="quantity"
            min="0"
            [attr.aria-invalid]="form.controls.quantity.invalid && form.controls.quantity.touched"
            aria-required="true"
          />
          @if (form.controls.quantity.invalid && form.controls.quantity.touched) {
            <p class="error" role="alert">
              @if (form.controls.quantity.errors?.['required']) {
                Quantity is required.
              } @else if (form.controls.quantity.errors?.['min']) {
                Quantity must be at least 0.
              }
            </p>
          }
        </div>

        <div class="form-group">
          <label for="unit">Unit <span aria-hidden="true">*</span></label>
          <select
            id="unit"
            formControlName="unit"
            [attr.aria-invalid]="form.controls.unit.invalid && form.controls.unit.touched"
            aria-required="true"
          >
            <option value="" disabled>Select a unit</option>
            @for (unit of unitOptions; track unit) {
              <option [value]="unit">{{ unit }}</option>
            }
          </select>
          @if (form.controls.unit.invalid && form.controls.unit.touched) {
            <p class="error" role="alert">Unit is required.</p>
          }
        </div>

        <div class="form-group">
          <label for="category">Category <span aria-hidden="true">*</span></label>
          <select
            id="category"
            formControlName="category"
            [attr.aria-invalid]="form.controls.category.invalid && form.controls.category.touched"
            aria-required="true"
          >
            <option value="" disabled>Select a category</option>
            @for (cat of categoryOptions; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
          @if (form.controls.category.invalid && form.controls.category.touched) {
            <p class="error" role="alert">Category is required.</p>
          }
        </div>

        <div class="form-group">
          <label for="barcode">Barcode</label>
          <input id="barcode" type="text" formControlName="barcode" />
        </div>

        <div class="form-group">
          <label for="expiryDate">Expiry Date</label>
          <input id="expiryDate" type="date" formControlName="expiryDate" />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn--primary" [disabled]="form.invalid">
            {{ isEditMode() ? 'Update' : 'Create' }}
          </button>
          <a routerLink="/pantry" class="btn btn--secondary">Cancel</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .pantry-form {
      max-width: 500px;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }

    .form-group input[aria-invalid="true"],
    .form-group select[aria-invalid="true"] {
      border-color: #d32f2f;
    }

    .error {
      color: #d32f2f;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .btn--primary {
      background-color: #1976d2;
      color: white;
    }

    .btn--primary:hover:not(:disabled) {
      background-color: #1565c0;
    }

    .btn--primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn--secondary {
      background-color: #757575;
      color: white;
    }

    .btn--secondary:hover {
      background-color: #616161;
    }
  `],
})
export class PantryFormComponent implements OnInit {
  private readonly pantryService = inject(PantryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isEditMode = signal(false);
  private editId = '';

  readonly unitOptions = Object.values(Unit);
  readonly categoryOptions = Object.values(PantryCategory);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    unit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    barcode: new FormControl('', { nonNullable: true }),
    expiryDate: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editId = id;
      this.pantryService.getById(id).subscribe((item) => {
        this.form.patchValue({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          barcode: item.barcode ?? '',
          expiryDate: item.expiryDate ?? '',
        });
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      quantity: value.quantity,
      unit: value.unit as Unit,
      category: value.category as PantryCategory,
      ...(value.barcode ? { barcode: value.barcode } : {}),
      ...(value.expiryDate ? { expiryDate: value.expiryDate } : {}),
    };

    if (this.isEditMode()) {
      this.pantryService.update(this.editId, payload).subscribe(() => {
        this.router.navigate(['/pantry']);
      });
    } else {
      this.pantryService.create(payload).subscribe(() => {
        this.router.navigate(['/pantry']);
      });
    }
  }
}
