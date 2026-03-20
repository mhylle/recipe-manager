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
      <h1>{{ isEditMode() ? 'Edit Pantry Item' : 'Add Pantry Item' }}</h1>

      <div class="card pantry-form__card">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label for="name" class="form-label">Name <span aria-hidden="true">*</span></label>
            <input
              id="name"
              type="text"
              class="input"
              formControlName="name"
              [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched"
              aria-required="true"
            />
            @if (form.controls.name.invalid && form.controls.name.touched) {
              <p class="form-error" role="alert">Name is required.</p>
            }
          </div>

          <div class="form-group">
            <label for="quantity" class="form-label">Quantity <span aria-hidden="true">*</span></label>
            <input
              id="quantity"
              type="number"
              class="input"
              formControlName="quantity"
              min="0"
              [attr.aria-invalid]="form.controls.quantity.invalid && form.controls.quantity.touched"
              aria-required="true"
            />
            @if (form.controls.quantity.invalid && form.controls.quantity.touched) {
              <p class="form-error" role="alert">
                @if (form.controls.quantity.errors?.['required']) {
                  Quantity is required.
                } @else if (form.controls.quantity.errors?.['min']) {
                  Quantity must be at least 0.
                }
              </p>
            }
          </div>

          <div class="form-group">
            <label for="unit" class="form-label">Unit <span aria-hidden="true">*</span></label>
            <select
              id="unit"
              class="input"
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
              <p class="form-error" role="alert">Unit is required.</p>
            }
          </div>

          <div class="form-group">
            <label for="category" class="form-label">Category <span aria-hidden="true">*</span></label>
            <select
              id="category"
              class="input"
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
              <p class="form-error" role="alert">Category is required.</p>
            }
          </div>

          <div class="form-group">
            <label for="barcode" class="form-label">Barcode</label>
            <input id="barcode" type="text" class="input" formControlName="barcode" />
          </div>

          <div class="form-group">
            <label for="expiryDate" class="form-label">Expiry Date</label>
            <input id="expiryDate" type="date" class="input" formControlName="expiryDate" />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn--primary" [disabled]="form.invalid">
              {{ isEditMode() ? 'Update' : 'Create' }}
            </button>
            <a routerLink="/pantry" class="btn btn--ghost">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .pantry-form {
      max-width: 540px;
    }

    .pantry-form h1 {
      margin-bottom: 1.5rem;
    }

    .pantry-form__card {
      padding: 2rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.375rem;
      font-weight: 500;
      color: var(--on-surface);
      font-size: 0.875rem;
    }

    .input[aria-invalid="true"] {
      border-color: var(--error);
      box-shadow: 0 0 0 3px rgba(186, 26, 26, 0.1);
    }

    .form-error {
      color: var(--error);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
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
