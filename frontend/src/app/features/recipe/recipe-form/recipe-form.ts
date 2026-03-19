import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { Unit } from '../../../shared/enums/unit.enum';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

@Component({
  selector: 'app-recipe-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="recipe-form">
      <h2>{{ isEditMode() ? 'Edit Recipe' : 'Add Recipe' }}</h2>

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
          <label for="description">Description <span aria-hidden="true">*</span></label>
          <textarea
            id="description"
            formControlName="description"
            rows="3"
            [attr.aria-invalid]="form.controls.description.invalid && form.controls.description.touched"
            aria-required="true"
          ></textarea>
          @if (form.controls.description.invalid && form.controls.description.touched) {
            <p class="error" role="alert">Description is required.</p>
          }
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="servings">Servings <span aria-hidden="true">*</span></label>
            <input
              id="servings"
              type="number"
              formControlName="servings"
              min="1"
              aria-required="true"
            />
          </div>

          <div class="form-group">
            <label for="prepTime">Prep Time (min) <span aria-hidden="true">*</span></label>
            <input
              id="prepTime"
              type="number"
              formControlName="prepTime"
              min="0"
              aria-required="true"
            />
          </div>

          <div class="form-group">
            <label for="cookTime">Cook Time (min) <span aria-hidden="true">*</span></label>
            <input
              id="cookTime"
              type="number"
              formControlName="cookTime"
              min="0"
              aria-required="true"
            />
          </div>

          <div class="form-group">
            <label for="difficulty">Difficulty <span aria-hidden="true">*</span></label>
            <select id="difficulty" formControlName="difficulty" aria-required="true">
              <option value="" disabled>Select difficulty</option>
              @for (diff of difficultyOptions; track diff) {
                <option [value]="diff">{{ diff }}</option>
              }
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="tags">Tags (comma-separated)</label>
          <input id="tags" type="text" formControlName="tags" placeholder="e.g. breakfast, quick, italian" />
        </div>

        <fieldset class="ingredients-section">
          <legend>Ingredients <span aria-hidden="true">*</span></legend>
          <div formArrayName="ingredients">
            @for (ingredient of ingredientsArray.controls; track $index; let i = $index) {
              <div class="ingredient-row" [formGroupName]="i">
                <input type="text" formControlName="name" placeholder="Ingredient name" [attr.aria-label]="'Ingredient ' + (i + 1) + ' name'" />
                <input type="number" formControlName="quantity" placeholder="Qty" min="0" [attr.aria-label]="'Ingredient ' + (i + 1) + ' quantity'" />
                <select formControlName="unit" [attr.aria-label]="'Ingredient ' + (i + 1) + ' unit'">
                  @for (unit of unitOptions; track unit) {
                    <option [value]="unit">{{ unit }}</option>
                  }
                </select>
                <select formControlName="pantryCategory" [attr.aria-label]="'Ingredient ' + (i + 1) + ' category'">
                  @for (cat of categoryOptions; track cat) {
                    <option [value]="cat">{{ cat }}</option>
                  }
                </select>
                <button
                  type="button"
                  class="btn btn--small btn--danger"
                  (click)="removeIngredient(i)"
                  [attr.aria-label]="'Remove ingredient ' + (i + 1)"
                >
                  Remove
                </button>
              </div>
            }
          </div>
          <button type="button" class="btn btn--small btn--add" (click)="addIngredient()">
            + Add Ingredient
          </button>
        </fieldset>

        <div class="form-group">
          <label for="instructions">Instructions (one per line) <span aria-hidden="true">*</span></label>
          <textarea
            id="instructions"
            formControlName="instructions"
            rows="6"
            placeholder="Step 1&#10;Step 2&#10;Step 3"
            aria-required="true"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn--primary" [disabled]="form.invalid">
            {{ isEditMode() ? 'Update' : 'Create' }}
          </button>
          <a routerLink="/recipes" class="btn btn--secondary">Cancel</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .recipe-form {
      max-width: 700px;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label,
    .form-group legend {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
      font-family: inherit;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .form-row .form-group {
      margin-bottom: 0;
    }

    .ingredients-section {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .ingredients-section legend {
      font-weight: 600;
      padding: 0 0.5rem;
    }

    .ingredient-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr auto;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      align-items: center;
    }

    .ingredient-row input,
    .ingredient-row select {
      padding: 0.375rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.875rem;
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

    .btn--small {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn--danger {
      background-color: #d32f2f;
      color: white;
    }

    .btn--add {
      background-color: #e8f5e9;
      color: #2e7d32;
      margin-top: 0.5rem;
    }

    .btn--add:hover {
      background-color: #c8e6c9;
    }
  `],
})
export class RecipeFormComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isEditMode = signal(false);
  private editId = '';

  readonly unitOptions = Object.values(Unit);
  readonly difficultyOptions = Object.values(Difficulty);
  readonly categoryOptions = Object.values(PantryCategory);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    servings: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    prepTime: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    cookTime: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    difficulty: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tags: new FormControl('', { nonNullable: true }),
    instructions: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ingredients: new FormArray<FormGroup>([]),
  });

  get ingredientsArray(): FormArray {
    return this.form.controls.ingredients;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editId = id;
      this.recipeService.getById(id).subscribe((recipe) => {
        this.form.patchValue({
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          tags: recipe.tags.join(', '),
          instructions: recipe.instructions.join('\n'),
        });
        // Clear and re-populate ingredients
        this.ingredientsArray.clear();
        recipe.ingredients.forEach((ing) => {
          this.ingredientsArray.push(this.createIngredientGroup(ing.name, ing.quantity, ing.unit, ing.pantryCategory));
        });
      });
    } else {
      // Start with one empty ingredient row
      this.addIngredient();
    }
  }

  addIngredient(): void {
    this.ingredientsArray.push(this.createIngredientGroup());
  }

  removeIngredient(index: number): void {
    this.ingredientsArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      description: value.description,
      servings: value.servings,
      prepTime: value.prepTime,
      cookTime: value.cookTime,
      difficulty: value.difficulty as Difficulty,
      tags: value.tags ? value.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
      instructions: value.instructions.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0),
      ingredients: value.ingredients.map((ing) => ({
        name: ing['name'] as string,
        quantity: Number(ing['quantity']),
        unit: ing['unit'] as Unit,
        pantryCategory: ing['pantryCategory'] as PantryCategory,
      })),
    };

    if (this.isEditMode()) {
      this.recipeService.update(this.editId, payload).subscribe(() => {
        this.router.navigate(['/recipes']);
      });
    } else {
      this.recipeService.create(payload).subscribe(() => {
        this.router.navigate(['/recipes']);
      });
    }
  }

  private createIngredientGroup(
    name = '',
    quantity = 0,
    unit: string = Unit.G,
    pantryCategory: string = PantryCategory.OTHER,
  ): FormGroup {
    return new FormGroup({
      name: new FormControl(name, { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl(quantity, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      unit: new FormControl(unit, { nonNullable: true, validators: [Validators.required] }),
      pantryCategory: new FormControl(pantryCategory, { nonNullable: true, validators: [Validators.required] }),
    });
  }
}
