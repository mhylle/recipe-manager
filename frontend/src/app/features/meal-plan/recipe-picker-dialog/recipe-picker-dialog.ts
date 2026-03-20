import { Component, ChangeDetectionStrategy, inject, signal, OnInit, output } from '@angular/core';
import { RecipeService } from '../../recipe/recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';

@Component({
  selector: 'app-recipe-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-backdrop" (click)="close()" (keydown.escape)="close()" role="dialog" aria-label="Select a recipe">
      <div class="dialog card" (click)="$event.stopPropagation()">
        <h3>Select a Recipe</h3>
        @if (recipes().length === 0) {
          <p class="dialog__empty">No recipes available. Create some recipes first.</p>
        } @else {
          <ul class="recipe-picker__list" role="listbox">
            @for (recipe of recipes(); track recipe.id) {
              <li role="option">
                <button type="button" class="recipe-picker__item" (click)="selectRecipe(recipe)">
                  <span class="recipe-picker__name">{{ recipe.name }}</span>
                  <span class="recipe-picker__meta">{{ recipe.prepTime + recipe.cookTime }}min | {{ recipe.servings }} servings</span>
                </button>
              </li>
            }
          </ul>
        }
        <div class="dialog__actions">
          <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(45, 52, 51, 0.4);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .dialog {
      max-width: 500px;
      width: 90%;
      padding: 2rem;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: var(--shadow-elevated);
    }

    .dialog h3 {
      margin-bottom: 1.25rem;
    }

    .dialog__empty {
      padding: 1.5rem 0;
      text-align: center;
      color: var(--on-surface-variant);
    }

    .dialog__actions {
      margin-top: 1rem;
      display: flex;
      justify-content: flex-end;
    }

    .recipe-picker__list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .recipe-picker__item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: var(--radius-xl);
      margin-bottom: 0.375rem;
      background: transparent;
      cursor: pointer;
      font-size: 0.9375rem;
      font-family: var(--font-body);
      color: var(--on-surface);
      transition: background 0.15s ease;
    }

    .recipe-picker__item:hover {
      background: var(--surface-container-low);
    }

    .recipe-picker__name {
      font-weight: 500;
    }

    .recipe-picker__meta {
      color: var(--on-surface-variant);
      font-size: 0.8125rem;
    }
  `],
})
export class RecipePickerDialogComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  readonly recipes = signal<Recipe[]>([]);
  readonly recipeSelected = output<Recipe>();
  readonly dialogClosed = output<void>();

  ngOnInit(): void {
    this.recipeService.getAll().subscribe((r) => this.recipes.set(r));
  }

  selectRecipe(recipe: Recipe): void {
    this.recipeSelected.emit(recipe);
  }

  close(): void {
    this.dialogClosed.emit();
  }
}
