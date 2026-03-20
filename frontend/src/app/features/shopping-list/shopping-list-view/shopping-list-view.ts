import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ShoppingListService } from '../shopping-list.service';
import { MealPlanService } from '../../meal-plan/meal-plan.service';
import { ShoppingList, ShoppingListItem } from '../../../shared/models/shopping-list.model';

@Component({
  selector: 'app-shopping-list-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="shopping-list">
      <div class="shopping-list__header">
        <div>
          <h1>Shopping List</h1>
          <p class="shopping-list__subtitle">Everything you need, nothing you do not.</p>
        </div>
        <button type="button" class="btn btn--primary" (click)="generateList()" [disabled]="generating()">
          {{ generating() ? 'Generating...' : 'Generate from Meal Plan' }}
        </button>
      </div>

      @if (shoppingList()) {
        <p class="shopping-list__info label-text">
          Generated: {{ shoppingList()!.generatedDate | date:'medium' }}
        </p>

        @if (shoppingList()!.items.length === 0) {
          <div class="card shopping-list__empty" role="status">
            <p>All ingredients are already in your pantry. Nothing to buy!</p>
          </div>
        } @else {
          <div class="card">
            <ul class="shopping-list__items" role="list">
              @for (item of shoppingList()!.items; track $index) {
                <li class="shopping-list__item" [class.shopping-list__item--checked]="item.checked">
                  <label class="shopping-list__label">
                    <input
                      type="checkbox"
                      [checked]="item.checked"
                      (change)="toggleItem($index)"
                      [attr.aria-label]="item.name + ' - ' + item.quantity + ' ' + item.unit"
                    />
                    <span class="shopping-list__name">{{ item.name }}</span>
                    <span class="shopping-list__qty">{{ item.quantity }} {{ item.unit }}</span>
                  </label>
                </li>
              }
            </ul>
          </div>
        }
      } @else {
        <div class="card shopping-list__empty" role="status">
          <p>No shopping list generated yet. Click "Generate from Meal Plan" to create one.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .shopping-list {
      max-width: 640px;
    }

    .shopping-list__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;
    }

    .shopping-list__header h1 {
      margin-bottom: 0.25rem;
    }

    .shopping-list__subtitle {
      color: var(--on-surface-variant);
      font-size: 1rem;
    }

    .shopping-list__info {
      margin-bottom: 1rem;
    }

    .shopping-list__empty {
      text-align: center;
      padding: 3rem var(--spacing-card);
      color: var(--on-surface-variant);
    }

    .shopping-list__items {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .shopping-list__item {
      padding: 0.75rem 0;
      transition: opacity 0.2s ease;
    }

    .shopping-list__item + .shopping-list__item {
      border-top: 1px solid var(--outline-variant);
    }

    .shopping-list__item--checked {
      opacity: 0.4;
    }

    .shopping-list__item--checked .shopping-list__name {
      text-decoration: line-through;
    }

    .shopping-list__label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
    }

    .shopping-list__label input[type="checkbox"] {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: var(--primary);
      flex-shrink: 0;
    }

    .shopping-list__name {
      flex: 1;
      font-weight: 500;
      color: var(--on-surface);
    }

    .shopping-list__qty {
      color: var(--on-surface-variant);
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      .shopping-list__header {
        flex-direction: column;
      }
    }
  `],
})
export class ShoppingListViewComponent implements OnInit {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly route = inject(ActivatedRoute);

  readonly shoppingList = signal<ShoppingList | null>(null);
  readonly generating = signal(false);
  private currentMealPlanId = '';

  ngOnInit(): void {
    // If navigated with a list ID (e.g. from recipe detail), load it
    const listId = this.route.snapshot.queryParamMap.get('id');
    if (listId) {
      this.shoppingListService.getById(listId).subscribe((list) => {
        this.shoppingList.set(list);
      });
    }

    // Load current week's meal plan to get its ID
    const weekStart = this.getWeekStartDate();
    this.mealPlanService.getByWeek(weekStart).subscribe((plan) => {
      this.currentMealPlanId = plan.id;
    });
  }

  generateList(): void {
    if (!this.currentMealPlanId) return;
    this.generating.set(true);
    this.shoppingListService.generate(this.currentMealPlanId).subscribe({
      next: (list) => {
        this.shoppingList.set(list);
        this.generating.set(false);
      },
      error: () => this.generating.set(false),
    });
  }

  toggleItem(index: number): void {
    const list = this.shoppingList();
    if (!list) return;
    this.shoppingListService.toggleItem(list.id, index).subscribe((updated) => {
      this.shoppingList.set(updated);
    });
  }

  private getWeekStartDate(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split('T')[0];
  }
}
