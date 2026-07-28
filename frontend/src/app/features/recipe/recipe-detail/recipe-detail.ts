import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { AuthService } from '../../../shared/services/auth.service';
import { WakeLockService } from '../../../shared/services/wake-lock.service';
import {
  EnumLabelPipe,
  LocaleNumberPipe,
  LocaleService,
  TranslatePipe,
  reloadOnLocaleChange,
} from '../../../shared/i18n';

@Component({
  selector: 'app-recipe-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, LocaleNumberPipe],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.scss',
})
export class RecipeDetailComponent implements OnInit, OnDestroy {
  private readonly recipeService = inject(RecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly locale = inject(LocaleService);
  // Exposed to the template so the toggle can reflect real lock state.
  readonly wakeLock = inject(WakeLockService);

  readonly recipe = signal<Recipe | null>(null);
  readonly regenerating = signal(false);
  readonly addingToList = signal(false);

  readonly totalTime = computed(() => {
    const r = this.recipe();
    return r ? r.prepTime + r.cookTime : 0;
  });

  // Re-fetches on every language switch; API content is localised server-side.
  private readonly reload = reloadOnLocaleChange(() => this.loadRecipe());

  ngOnInit(): void {
    this.authService.checkAuth();
  }

  ngOnDestroy(): void {
    // The lock must not outlive the recipe that asked for it — walking away from
    // the page should not leave a phone burning its battery on a bright screen.
    void this.wakeLock.disable();
  }

  toggleWakeLock(): void {
    void this.wakeLock.toggle();
  }

  private loadRecipe(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.recipeService.getById(id).subscribe((recipe) => {
        this.recipe.set(recipe);
      });
    }
  }

  onDelete(): void {
    const currentRecipe = this.recipe();
    if (
      currentRecipe &&
      confirm(this.locale.translate('common.confirm.delete', { name: currentRecipe.name }))
    ) {
      this.recipeService.delete(currentRecipe.id).subscribe(() => {
        this.router.navigate(['/recipes']);
      });
    }
  }

  addToShoppingList(): void {
    const currentRecipe = this.recipe();
    if (!currentRecipe) return;

    this.addingToList.set(true);
    this.shoppingListService.generateFromRecipe(currentRecipe.id, currentRecipe.servings).subscribe({
      next: (list) => {
        this.addingToList.set(false);
        this.router.navigate(['/shopping-list'], { queryParams: { id: list.id } });
      },
      error: () => {
        this.addingToList.set(false);
      },
    });
  }

  regenerateImages(): void {
    const currentRecipe = this.recipe();
    if (!currentRecipe) return;

    this.regenerating.set(true);
    this.recipeService.regenerateImages(currentRecipe.id).subscribe({
      next: () => {
        setTimeout(() => {
          this.recipeService.getById(currentRecipe.id).subscribe((recipe) => {
            this.recipe.set(recipe);
            this.regenerating.set(false);
          });
        }, 2000);
      },
      error: () => {
        this.regenerating.set(false);
      },
    });
  }
}
