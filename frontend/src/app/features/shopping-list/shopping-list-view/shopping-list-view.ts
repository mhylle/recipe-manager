import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
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
        <h2>Shopping List</h2>
        <button type="button" class="btn btn--primary" (click)="generateList()" [disabled]="generating()">
          {{ generating() ? 'Generating...' : 'Generate from Meal Plan' }}
        </button>
      </div>

      @if (shoppingList()) {
        <p class="shopping-list__info">
          Generated: {{ shoppingList()!.generatedDate | date:'medium' }}
        </p>

        @if (shoppingList()!.items.length === 0) {
          <p class="shopping-list__empty" role="status">
            All ingredients are already in your pantry. Nothing to buy!
          </p>
        } @else {
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
        }
      } @else {
        <p class="shopping-list__empty" role="status">
          No shopping list generated yet. Click "Generate from Meal Plan" to create one.
        </p>
      }
    </div>
  `,
  styles: [`
    .shopping-list { max-width: 600px; }
    .shopping-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .shopping-list__info { color: #888; font-size: 0.8125rem; margin-bottom: 1rem; }
    .shopping-list__empty { text-align: center; padding: 2rem; color: #666; }
    .shopping-list__items { list-style: none; padding: 0; margin: 0; }
    .shopping-list__item { padding: 0.75rem; border-bottom: 1px solid #e0e0e0; }
    .shopping-list__item--checked { opacity: 0.5; }
    .shopping-list__item--checked .shopping-list__name { text-decoration: line-through; }
    .shopping-list__label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; }
    .shopping-list__label input[type="checkbox"] { width: 1.125rem; height: 1.125rem; }
    .shopping-list__name { flex: 1; font-weight: 500; }
    .shopping-list__qty { color: #888; font-size: 0.875rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; }
    .btn--primary { background-color: #1976d2; color: white; }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class ShoppingListViewComponent implements OnInit {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly mealPlanService = inject(MealPlanService);

  readonly shoppingList = signal<ShoppingList | null>(null);
  readonly generating = signal(false);
  private currentMealPlanId = '';

  ngOnInit(): void {
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
