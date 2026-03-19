import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService, MatchResult, AlmostCanMakeEntry } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="dashboard">
      <h2>Dashboard</h2>
      <p class="dashboard__subtitle">Recipe availability based on your pantry</p>

      <section class="bucket bucket--can-make" aria-labelledby="can-make-heading">
        <div class="bucket__header" (click)="toggleCanMake()" (keydown.enter)="toggleCanMake()" tabindex="0" role="button" [attr.aria-expanded]="canMakeOpen()">
          <h3 id="can-make-heading">Can Make Now ({{ matchResult().canMakeNow.length }})</h3>
        </div>
        @if (canMakeOpen()) {
          @if (matchResult().canMakeNow.length === 0) {
            <p class="bucket__empty">No recipes can be made with current pantry items.</p>
          } @else {
            <ul class="bucket__list" role="list">
              @for (recipe of matchResult().canMakeNow; track recipe.id) {
                <li class="bucket__item">
                  <a [routerLink]="['/recipes', recipe.id]">{{ recipe.name }}</a>
                  <span class="bucket__meta">{{ recipe.prepTime + recipe.cookTime }}min total</span>
                </li>
              }
            </ul>
          }
        }
      </section>

      <section class="bucket bucket--almost" aria-labelledby="almost-heading">
        <div class="bucket__header" (click)="toggleAlmost()" (keydown.enter)="toggleAlmost()" tabindex="0" role="button" [attr.aria-expanded]="almostOpen()">
          <h3 id="almost-heading">Need 1-2 Items ({{ matchResult().almostCanMake.length }})</h3>
        </div>
        @if (almostOpen()) {
          @if (matchResult().almostCanMake.length === 0) {
            <p class="bucket__empty">No recipes in this category.</p>
          } @else {
            <ul class="bucket__list" role="list">
              @for (entry of matchResult().almostCanMake; track entry.recipe.id) {
                <li class="bucket__item">
                  <div>
                    <a [routerLink]="['/recipes', entry.recipe.id]">{{ entry.recipe.name }}</a>
                    @if (entry.usesExpiringIngredients) {
                      <span class="expiry-label">Use it soon!</span>
                    }
                    <span class="bucket__missing">
                      Missing: {{ getMissingNames(entry.missingIngredients) }}
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        }
      </section>

      <section class="bucket bucket--missing" aria-labelledby="missing-heading">
        <div class="bucket__header" (click)="toggleMissing()" (keydown.enter)="toggleMissing()" tabindex="0" role="button" [attr.aria-expanded]="missingOpen()">
          <h3 id="missing-heading">Missing Many Items ({{ matchResult().missingMany.length }})</h3>
        </div>
        @if (missingOpen()) {
          @if (matchResult().missingMany.length === 0) {
            <p class="bucket__empty">No recipes in this category.</p>
          } @else {
            <ul class="bucket__list" role="list">
              @for (recipe of matchResult().missingMany; track recipe.id) {
                <li class="bucket__item">
                  <a [routerLink]="['/recipes', recipe.id]">{{ recipe.name }}</a>
                </li>
              }
            </ul>
          }
        }
      </section>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 800px; }
    .dashboard__subtitle { color: #666; margin-bottom: 1.5rem; }
    .bucket { margin-bottom: 1.5rem; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .bucket__header { padding: 1rem 1.25rem; cursor: pointer; user-select: none; }
    .bucket__header h3 { margin: 0; font-size: 1.0625rem; }
    .bucket--can-make .bucket__header { background-color: #e8f5e9; color: #2e7d32; }
    .bucket--almost .bucket__header { background-color: #fff3e0; color: #ef6c00; }
    .bucket--missing .bucket__header { background-color: #fce4ec; color: #c62828; }
    .bucket__empty { padding: 1rem 1.25rem; color: #666; font-style: italic; }
    .bucket__list { list-style: none; padding: 0; margin: 0; }
    .bucket__item { padding: 0.75rem 1.25rem; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .bucket__item a { color: #1976d2; text-decoration: none; font-weight: 500; }
    .bucket__item a:hover { text-decoration: underline; }
    .bucket__meta { color: #888; font-size: 0.8125rem; }
    .bucket__missing { display: block; color: #ef6c00; font-size: 0.8125rem; margin-top: 0.25rem; }
    .expiry-label { display: inline-block; margin-left: 0.5rem; padding: 0.125rem 0.5rem; background-color: #fff3e0; color: #ef6c00; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
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
