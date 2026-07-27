import { Component, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { RecipeService } from '../../recipe/recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { TranslatePipe, reloadOnLocaleChange } from '../../../shared/i18n';

@Component({
  selector: 'app-recipe-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './recipe-picker-dialog.html',
  styleUrl: './recipe-picker-dialog.scss',
})
export class RecipePickerDialogComponent {
  private readonly recipeService = inject(RecipeService);
  readonly recipes = signal<Recipe[]>([]);
  readonly recipeSelected = output<Recipe>();
  readonly dialogClosed = output<void>();

  private readonly reload = reloadOnLocaleChange(() =>
    this.recipeService.getAll().subscribe((r) => this.recipes.set(r)),
  );

  selectRecipe(recipe: Recipe): void {
    this.recipeSelected.emit(recipe);
  }

  close(): void {
    this.dialogClosed.emit();
  }
}
