import { Component, ChangeDetectionStrategy, inject, signal, OnInit, output } from '@angular/core';
import { RecipeService } from '../../recipe/recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';

@Component({
  selector: 'app-recipe-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-backdrop" (click)="close()" (keydown.escape)="close()" role="dialog" aria-label="Select a recipe">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h3>Select a Recipe</h3>
        @if (recipes().length === 0) {
          <p>No recipes available. Create some recipes first.</p>
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
        <button type="button" class="btn btn--secondary" (click)="close()">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .dialog { background: white; border-radius: 8px; padding: 1.5rem; min-width: 400px; max-height: 80vh; overflow-y: auto; }
    .dialog h3 { margin-top: 0; }
    .recipe-picker__list { list-style: none; padding: 0; margin: 1rem 0; }
    .recipe-picker__item { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0.75rem; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 0.5rem; background: white; cursor: pointer; font-size: 0.9375rem; }
    .recipe-picker__item:hover { background: #f5f5f5; }
    .recipe-picker__name { font-weight: 500; }
    .recipe-picker__meta { color: #888; font-size: 0.8125rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; }
    .btn--secondary { background-color: #757575; color: white; }
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
