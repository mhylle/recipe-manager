import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-recipe-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (recipe()) {
      <article class="recipe-view">
        <!-- Hero Section -->
        <div class="recipe-view__hero" [class.recipe-view__hero--no-image]="!recipe()!.imageUrl">
          @if (recipe()!.imageUrl) {
            <img
              [src]="recipe()!.imageUrl"
              [alt]="recipe()!.name"
              class="recipe-view__hero-image"
            />
            <div class="recipe-view__hero-overlay"></div>
          }
          <div class="recipe-view__hero-content">
            <div class="recipe-view__badges">
              <span class="badge" [class]="'badge--' + recipe()!.difficulty">
                {{ recipe()!.difficulty }}
              </span>
              @if (totalTime()) {
                <span class="badge badge--time">{{ totalTime() }} min total</span>
              }
            </div>
            <h1 class="recipe-view__title">{{ recipe()!.name }}</h1>
            <p class="recipe-view__description">{{ recipe()!.description }}</p>
          </div>
        </div>

        <!-- Quick Info Bar -->
        <div class="recipe-view__info-bar">
          <div class="info-item">
            <span class="info-item__icon" aria-hidden="true">&#9202;</span>
            <div class="info-item__text">
              <span class="info-item__label">Prep</span>
              <span class="info-item__value">{{ recipe()!.prepTime }} min</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon" aria-hidden="true">&#127859;</span>
            <div class="info-item__text">
              <span class="info-item__label">Cook</span>
              <span class="info-item__value">{{ recipe()!.cookTime }} min</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon" aria-hidden="true">&#127860;</span>
            <div class="info-item__text">
              <span class="info-item__label">Servings</span>
              <span class="info-item__value">{{ recipe()!.servings }}</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon" aria-hidden="true">&#127869;</span>
            <div class="info-item__text">
              <span class="info-item__label">Ingredients</span>
              <span class="info-item__value">{{ recipe()!.ingredients.length }}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        @if (recipe()!.tags.length > 0) {
          <div class="recipe-view__tags">
            @for (tag of recipe()!.tags; track tag) {
              <span class="tag">{{ tag }}</span>
            }
          </div>
        }

        <!-- Two Column Layout: Ingredients + Instructions -->
        <div class="recipe-view__body">
          <!-- Ingredients Panel -->
          <aside class="recipe-view__ingredients">
            <h2 class="section-heading">Ingredients</h2>
            <ul class="ingredients-list" role="list">
              @for (ing of recipe()!.ingredients; track $index) {
                <li class="ingredient-item">
                  <span class="ingredient-item__qty">{{ ing.quantity }} {{ ing.unit }}</span>
                  <span class="ingredient-item__name">{{ ing.name }}</span>
                  <span class="ingredient-item__category">{{ ing.pantryCategory }}</span>
                </li>
              }
            </ul>
          </aside>

          <!-- Instructions Panel -->
          <section class="recipe-view__instructions">
            <h2 class="section-heading">Instructions</h2>
            <ol class="instructions-list" role="list">
              @for (step of recipe()!.instructions; track step; let i = $index) {
                <li class="instruction-step">
                  <span class="instruction-step__number" aria-hidden="true">{{ i + 1 }}</span>
                  <div class="instruction-step__content">
                    @if (recipe()!.instructionImages?.[i]) {
                      <img [src]="recipe()!.instructionImages![i]" [alt]="'Step ' + (i + 1) + ' illustration'" class="step-image" />
                    }
                    <p class="instruction-step__text">{{ step }}</p>
                  </div>
                </li>
              }
            </ol>
          </section>
        </div>

        <!-- Image placeholder when no image -->
        @if (!recipe()!.imageUrl) {
          <div class="recipe-view__image-placeholder">
            <span class="recipe-view__image-placeholder-icon" aria-hidden="true">&#128247;</span>
            <p>No image yet. Edit this recipe to add a photo URL.</p>
          </div>
        }

        <!-- Actions -->
        <nav class="recipe-view__actions" aria-label="Recipe actions">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="addingToList()"
            (click)="addToShoppingList()"
          >
            {{ addingToList() ? 'Adding...' : 'Add to Shopping List' }}
          </button>
          <a [routerLink]="['/recipes', recipe()!.id, 'edit']" class="btn btn--ghost">
            Edit Recipe
          </a>
          <button
            type="button"
            class="btn btn--danger"
            (click)="onDelete()"
            [attr.aria-label]="'Delete ' + recipe()!.name"
          >
            Delete
          </button>
          @if (authService.isAdmin()) {
            <button
              type="button"
              class="btn btn--secondary"
              [disabled]="regenerating()"
              (click)="regenerateImages()"
            >
              {{ regenerating() ? 'Generating...' : 'Regenerate Images' }}
            </button>
          }
          <a routerLink="/recipes" class="btn btn--outline">
            Back to Recipes
          </a>
        </nav>
      </article>
    } @else {
      <div class="recipe-view__loading" role="status">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>Loading recipe...</p>
      </div>
    }
  `,
  styles: [`
    /* ===== Layout ===== */
    .recipe-view {
      max-width: 900px;
      margin: 0 auto;
    }

    /* ===== Hero Section ===== */
    .recipe-view__hero {
      position: relative;
      border-radius: var(--radius-xl);
      overflow: hidden;
      margin-bottom: 0;
      min-height: 280px;
      display: flex;
      align-items: flex-end;
    }

    .recipe-view__hero--no-image {
      background: linear-gradient(135deg, #2d3433 0%, #3e6a00 50%, #5a6b66 100%);
      min-height: 220px;
    }

    .recipe-view__hero-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .recipe-view__hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%);
    }

    .recipe-view__hero-content {
      position: relative;
      z-index: 1;
      padding: 2rem 2rem 1.75rem;
      width: 100%;
    }

    .recipe-view__badges {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .recipe-view__title {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 400;
      color: white;
      margin: 0 0 0.5rem;
      line-height: 1.2;
      text-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }

    .recipe-view__description {
      color: rgba(255,255,255,0.9);
      font-size: 1.0625rem;
      line-height: 1.5;
      margin: 0;
      max-width: 650px;
    }

    /* ===== Info Bar ===== */
    .recipe-view__info-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--surface-container-lowest);
      border-radius: var(--radius-xl);
      margin: -1.5rem 1.5rem 1.5rem;
      position: relative;
      z-index: 2;
      box-shadow: var(--shadow-elevated);
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
    }

    .info-item__icon {
      font-size: 1.5rem;
      line-height: 1;
    }

    .info-item__text {
      display: flex;
      flex-direction: column;
    }

    .info-item__label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--on-surface-variant);
      font-weight: 600;
    }

    .info-item__value {
      font-size: 1rem;
      font-weight: 600;
      color: var(--on-surface);
    }

    /* ===== Tags ===== */
    .recipe-view__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0 0.5rem;
      margin-bottom: 2rem;
    }

    /* ===== Badge ===== */
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge--easy {
      background: var(--primary-container);
      color: var(--primary);
    }

    .badge--medium {
      background: var(--secondary-container);
      color: var(--secondary);
    }

    .badge--hard {
      background: var(--error-container);
      color: var(--error);
    }

    .badge--time {
      background-color: rgba(255,255,255,0.2);
      color: white;
      backdrop-filter: blur(4px);
    }

    /* ===== Body: Two Column Layout ===== */
    .recipe-view__body {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .section-heading {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--on-surface);
      margin: 0 0 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--primary);
    }

    /* ===== Ingredients ===== */
    .recipe-view__ingredients {
      background: var(--surface-container-low);
      border: none;
      border-radius: var(--radius-xl);
      padding: 1.5rem;
      align-self: start;
      position: sticky;
      top: 1rem;
    }

    .ingredients-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .ingredient-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.5rem;
      align-items: baseline;
      padding: 0.625rem 0;
    }

    .ingredient-item__qty {
      font-weight: 700;
      color: var(--primary);
      font-size: 0.9375rem;
      white-space: nowrap;
    }

    .ingredient-item__name {
      font-size: 0.9375rem;
      color: var(--on-surface);
    }

    .ingredient-item__category {
      font-size: 0.6875rem;
      color: var(--on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      background: var(--surface-container-high);
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
    }

    /* ===== Instructions ===== */
    .recipe-view__instructions {
      min-width: 0;
    }

    .instructions-list {
      list-style: none;
      padding: 0;
      margin: 0;
      counter-reset: none;
    }

    .instruction-step {
      display: flex;
      gap: 1rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--outline-variant);
    }

    .instruction-step:last-child {
      border-bottom: none;
    }

    .instruction-step__number {
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      background: var(--primary);
      color: var(--on-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 700;
      margin-top: 0.125rem;
    }

    .instruction-step__content {
      flex: 1;
      min-width: 0;
    }

    .step-image {
      width: 100%;
      max-width: 400px;
      border-radius: var(--radius-md);
      margin-bottom: 0.5rem;
    }

    .instruction-step__text {
      margin: 0;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--on-surface);
    }

    /* ===== Image Placeholder ===== */
    .recipe-view__image-placeholder {
      text-align: center;
      padding: 2rem;
      background: var(--surface-container-low);
      border: 2px dashed var(--outline-variant);
      border-radius: var(--radius-xl);
      margin-bottom: 2rem;
      color: var(--on-surface-variant);
    }

    .recipe-view__image-placeholder-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .recipe-view__image-placeholder p {
      margin: 0;
      font-size: 0.875rem;
    }

    /* ===== Actions ===== */
    .recipe-view__actions {
      display: flex;
      gap: 0.75rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--outline-variant);
    }

    /* ===== Loading ===== */
    .recipe-view__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      color: var(--on-surface-variant);
    }

    .loading-spinner {
      width: 2.5rem;
      height: 2.5rem;
      border: 3px solid var(--outline-variant);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .recipe-view__hero {
        border-radius: 0;
        min-height: 200px;
      }

      .recipe-view__hero-content {
        padding: 1.25rem;
      }

      .recipe-view__title {
        font-size: 1.5rem;
      }

      .recipe-view__info-bar {
        grid-template-columns: repeat(2, 1fr);
        margin: -1rem 0.75rem 1rem;
      }

      .recipe-view__body {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .recipe-view__ingredients {
        position: static;
      }

      .recipe-view__actions {
        flex-wrap: wrap;
      }
    }
  `],
})
export class RecipeDetailComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly recipe = signal<Recipe | null>(null);
  readonly regenerating = signal(false);
  readonly addingToList = signal(false);

  readonly totalTime = computed(() => {
    const r = this.recipe();
    return r ? r.prepTime + r.cookTime : 0;
  });

  ngOnInit(): void {
    this.authService.checkAuth();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.recipeService.getById(id).subscribe((recipe) => {
        this.recipe.set(recipe);
      });
    }
  }

  onDelete(): void {
    const currentRecipe = this.recipe();
    if (currentRecipe && confirm(`Are you sure you want to delete "${currentRecipe.name}"?`)) {
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
