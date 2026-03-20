import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService, MatchResult, AlmostCanMakeEntry } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="dashboard">
      <!-- Hero -->
      <header class="dashboard__hero">
        <h1 class="dashboard__heading">Welcome home, <em>Chef.</em></h1>
        <p class="dashboard__subtitle">See what you can craft from your pantry today.</p>
      </header>

      <!-- READY TO CRAFT -->
      <section class="dashboard__section" aria-labelledby="can-make-heading">
        <div class="dashboard__section-header">
          <div>
            <span class="label-text" id="can-make-heading">READY TO CRAFT</span>
            <h2 class="dashboard__section-title">Available ingredients matched.</h2>
          </div>
          @if (matchResult().canMakeNow.length > 0) {
            <a routerLink="/recipes" class="dashboard__view-all">View all</a>
          }
        </div>
        @if (matchResult().canMakeNow.length === 0) {
          <p class="dashboard__empty" role="status">No recipes can be made with current pantry items.</p>
        } @else {
          <div class="dashboard__card-grid" role="list">
            @for (recipe of matchResult().canMakeNow; track recipe.id; let i = $index) {
              <a [routerLink]="['/recipes', recipe.id]"
                 class="card dashboard__recipe-card"
                 [class.dashboard__recipe-card--featured]="i === 0"
                 role="listitem">
                @if (recipe.imageUrl) {
                  <img [src]="recipe.imageUrl" [alt]="recipe.name" class="dashboard__card-image" />
                }
                <div class="dashboard__card-body">
                  <h3 class="dashboard__card-title">{{ recipe.name }}</h3>
                  <p class="dashboard__card-desc">{{ recipe.description }}</p>
                  <span class="label-text">{{ recipe.prepTime + recipe.cookTime }} min total</span>
                </div>
              </a>
            }
          </div>
        }
      </section>

      <!-- ALMOST THERE -->
      <section class="dashboard__section" aria-labelledby="almost-heading">
        <div class="dashboard__section-header">
          <div>
            <span class="label-text" id="almost-heading">ALMOST THERE</span>
            <h2 class="dashboard__section-title">Just one or two pieces missing.</h2>
          </div>
        </div>
        @if (matchResult().almostCanMake.length === 0) {
          <p class="dashboard__empty" role="status">No recipes in this category.</p>
        } @else {
          <div class="dashboard__almost-grid" role="list">
            @for (entry of matchResult().almostCanMake; track entry.recipe.id) {
              <div class="card dashboard__almost-card" role="listitem">
                <div class="dashboard__almost-top">
                  <a [routerLink]="['/recipes', entry.recipe.id]" class="dashboard__almost-name">
                    {{ entry.recipe.name }}
                  </a>
                  @if (entry.usesExpiringIngredients) {
                    <span class="dashboard__expiry-badge">Use it soon!</span>
                  }
                </div>
                <div class="dashboard__missing-pills">
                  @for (ing of entry.missingIngredients; track ing.name) {
                    <span class="chip">{{ ing.name }}</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- THE INVENTORY -->
      <section class="dashboard__section" aria-labelledby="missing-heading">
        <div class="dashboard__section-header">
          <div>
            <span class="label-text" id="missing-heading">THE INVENTORY</span>
            <h2 class="dashboard__section-title">Awaiting replenishment.</h2>
          </div>
        </div>
        @if (matchResult().missingMany.length === 0) {
          <p class="dashboard__empty" role="status">No recipes in this category.</p>
        } @else {
          <ul class="dashboard__link-list" role="list">
            @for (recipe of matchResult().missingMany; track recipe.id) {
              <li>
                <a [routerLink]="['/recipes', recipe.id]">{{ recipe.name }}</a>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 860px;
    }

    /* Hero */
    .dashboard__hero {
      margin-bottom: var(--spacing-section);
    }

    .dashboard__heading {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 400;
      color: var(--on-surface);
      line-height: 1.15;
      margin: 0 0 0.5rem;
    }

    .dashboard__heading em {
      font-style: italic;
    }

    .dashboard__subtitle {
      font-family: var(--font-body);
      font-size: 1.0625rem;
      color: var(--on-surface-variant);
      margin: 0;
    }

    /* Sections */
    .dashboard__section {
      margin-bottom: var(--spacing-section);
    }

    .dashboard__section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
    }

    .dashboard__section-title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 400;
      color: var(--on-surface);
      margin: 0.375rem 0 0;
    }

    .dashboard__view-all {
      font-family: var(--font-body);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--primary);
      text-decoration: none;
      white-space: nowrap;
    }

    .dashboard__view-all:hover {
      color: var(--primary-hover);
    }

    .dashboard__empty {
      color: var(--on-surface-variant);
      font-style: italic;
      padding: 1rem 0;
    }

    /* Ready to Craft — Card Grid */
    .dashboard__card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .dashboard__recipe-card {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.2s ease, transform 0.2s ease;
      overflow: hidden;
      padding: 0;
    }

    .dashboard__recipe-card:hover {
      box-shadow: var(--shadow-elevated);
      transform: translateY(-2px);
    }

    .dashboard__recipe-card--featured {
      grid-column: 1 / -1;
    }

    @media (min-width: 640px) {
      .dashboard__recipe-card--featured {
        grid-column: 1 / span 2;
      }
    }

    .dashboard__card-image {
      width: 100%;
      height: 180px;
      object-fit: cover;
    }

    .dashboard__recipe-card--featured .dashboard__card-image {
      height: 240px;
    }

    .dashboard__card-body {
      padding: var(--spacing-card);
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .dashboard__card-title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--on-surface);
      margin: 0;
    }

    .dashboard__card-desc {
      font-size: 0.875rem;
      color: var(--on-surface-variant);
      margin: 0;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Almost There — Grid */
    .dashboard__almost-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .dashboard__almost-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .dashboard__almost-top {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-wrap: wrap;
    }

    .dashboard__almost-name {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 400;
      color: var(--primary);
      text-decoration: none;
    }

    .dashboard__almost-name:hover {
      color: var(--primary-hover);
    }

    .dashboard__expiry-badge {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      background: var(--secondary-container);
      color: var(--secondary);
      border-radius: var(--radius-full);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .dashboard__missing-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    /* The Inventory — Link List */
    .dashboard__link-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dashboard__link-list li a {
      font-family: var(--font-body);
      font-size: 0.9375rem;
      color: var(--on-surface-variant);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .dashboard__link-list li a:hover {
      color: var(--primary);
    }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly matchResult = signal<MatchResult>({
    canMakeNow: [],
    almostCanMake: [],
    missingMany: [],
  });

  readonly canMakeOpen = signal(true);
  readonly almostOpen = signal(true);
  readonly missingOpen = signal(true);

  ngOnInit(): void {
    this.dashboardService.getMatchResults().subscribe((result) => {
      this.matchResult.set(result);
    });
  }

  toggleCanMake(): void { this.canMakeOpen.update((v) => !v); }
  toggleAlmost(): void { this.almostOpen.update((v) => !v); }
  toggleMissing(): void { this.missingOpen.update((v) => !v); }

  getMissingNames(ingredients: { name: string }[]): string {
    return ingredients.map((i) => i.name).join(', ');
  }
}
