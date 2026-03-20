import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { MealPlanService } from '../meal-plan.service';
import { RecipeService } from '../../recipe/recipe.service';
import { MealPlan, MealPlanEntry } from '../../../shared/models/meal-plan.model';
import { Recipe } from '../../../shared/models/recipe.model';
import { DayOfWeek } from '../../../shared/enums/day-of-week.enum';
import { MealType } from '../../../shared/enums/meal-type.enum';
import { RecipePickerDialogComponent } from '../recipe-picker-dialog/recipe-picker-dialog';

@Component({
  selector: 'app-meal-plan-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecipePickerDialogComponent],
  template: `
    <div class="meal-plan">
      <div class="meal-plan__header">
        <div>
          <h1>Meal Plan</h1>
          <p class="meal-plan__subtitle">A curated selection of seasonal recipes designed for mindful preparation.</p>
        </div>
        <div class="meal-plan__header-actions">
          <span class="meal-plan__week-label">Week of {{ currentWeek() }}</span>
        </div>
      </div>

      <div class="grid-container">
        <table class="meal-grid" aria-label="Weekly meal plan">
          <thead>
            <tr>
              <th scope="col" class="meal-grid__corner"></th>
              @for (day of days; track day) {
                <th scope="col" class="meal-grid__day-header">
                  <span class="meal-grid__day-abbr">{{ formatDay(day) }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (meal of meals; track meal) {
              <tr>
                <th scope="row" class="meal-grid__meal-label">
                  <span class="meal-grid__meal-pill" [class.meal-grid__meal-pill--breakfast]="meal === 'breakfast'" [class.meal-grid__meal-pill--lunch]="meal === 'lunch'" [class.meal-grid__meal-pill--dinner]="meal === 'dinner'" [class.meal-grid__meal-pill--snack]="meal === 'snack'">{{ formatMeal(meal) }}</span>
                </th>
                @for (day of days; track day) {
                  <td class="meal-grid__cell">
                    @if (getEntry(day, meal); as entry) {
                      <div class="meal-grid__entry">
                        <span class="meal-grid__recipe-name">{{ getRecipeName(entry.recipeId) }}</span>
                        <span class="meal-grid__servings">{{ entry.servings }} srv</span>
                        <div class="meal-grid__entry-actions">
                          <button type="button" class="btn btn--small btn--ghost" (click)="confirmCooked(entry)" [attr.aria-label]="'Mark as cooked: ' + getRecipeName(entry.recipeId)">Done</button>
                          <button type="button" class="btn btn--small btn--text" (click)="removeEntry(entry)" [attr.aria-label]="'Remove ' + getRecipeName(entry.recipeId)">Remove</button>
                        </div>
                      </div>
                    } @else {
                      <button type="button" class="meal-grid__add-btn" (click)="openPicker(day, meal)" [attr.aria-label]="'Add recipe for ' + formatDay(day) + ' ' + formatMeal(meal)">+</button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (showPicker()) {
        <app-recipe-picker-dialog
          (recipeSelected)="onRecipeSelected($event)"
          (dialogClosed)="closePicker()"
        />
      }
    </div>
  `,
  styles: [`
    .meal-plan__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .meal-plan__header h1 {
      margin-bottom: 0.25rem;
    }

    .meal-plan__subtitle {
      color: var(--on-surface-variant);
      font-size: 1rem;
    }

    .meal-plan__header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .meal-plan__week-label {
      font-family: var(--font-body);
      font-size: 0.875rem;
      color: var(--on-surface-variant);
      padding: 0.375rem 0.75rem;
      background: var(--surface-container-low);
      border-radius: var(--radius-full);
    }

    .grid-container {
      overflow-x: auto;
    }

    .meal-grid {
      width: 100%;
      border-collapse: separate;
      border-spacing: 6px;
      table-layout: fixed;
    }

    .meal-grid__corner {
      width: 90px;
    }

    .meal-grid__day-header {
      text-align: center;
      padding: 0.75rem 0.5rem;
    }

    .meal-grid__day-abbr {
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--on-surface-variant);
    }

    .meal-grid__meal-label {
      vertical-align: middle;
      text-align: center;
      padding: 0.5rem;
    }

    .meal-grid__meal-pill {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-full);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .meal-grid__meal-pill--breakfast {
      background: var(--primary-container);
      color: var(--primary);
    }

    .meal-grid__meal-pill--lunch {
      background: var(--secondary-container);
      color: var(--secondary);
    }

    .meal-grid__meal-pill--dinner {
      background: var(--surface-container-high);
      color: var(--on-surface);
    }

    .meal-grid__meal-pill--snack {
      background: var(--surface-container-low);
      color: var(--on-surface-variant);
    }

    .meal-grid__cell {
      background: var(--surface-container-lowest);
      border-radius: var(--radius-lg);
      padding: 0.625rem;
      min-height: 100px;
      vertical-align: top;
      box-shadow: var(--shadow-ambient);
    }

    .meal-grid__entry {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .meal-grid__recipe-name {
      font-family: var(--font-display);
      font-size: 0.8125rem;
      font-weight: 400;
      color: var(--on-surface);
      line-height: 1.3;
    }

    .meal-grid__servings {
      font-size: 0.6875rem;
      color: var(--on-surface-variant);
    }

    .meal-grid__entry-actions {
      display: flex;
      gap: 0.125rem;
      margin-top: 0.25rem;
    }

    .meal-grid__entry-actions .btn {
      padding: 0.125rem 0.375rem;
      font-size: 0.6875rem;
    }

    .meal-grid__add-btn {
      width: 100%;
      min-height: 80px;
      border: 2px dashed var(--outline-variant);
      background: transparent;
      cursor: pointer;
      font-size: 1.25rem;
      color: var(--on-surface-variant);
      border-radius: var(--radius-lg);
      transition: all 0.15s ease;
    }

    .meal-grid__add-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: rgba(62, 106, 0, 0.03);
    }

    @media (max-width: 768px) {
      .meal-plan__header {
        flex-direction: column;
      }
    }
  `],
})
export class MealPlanGridComponent implements OnInit {
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);

  readonly days = Object.values(DayOfWeek);
  readonly meals = Object.values(MealType);

  readonly plan = signal<MealPlan | null>(null);
  readonly recipes = signal<Map<string, Recipe>>(new Map());
  readonly showPicker = signal(false);
  private pickerDay: DayOfWeek | null = null;
  private pickerMeal: MealType | null = null;

  readonly currentWeek = computed(() => {
    const p = this.plan();
    return p ? p.weekStartDate : '';
  });

  ngOnInit(): void {
    const weekStart = this.getWeekStartDate();
    this.mealPlanService.getByWeek(weekStart).subscribe((plan) => {
      this.plan.set(plan);
    });
    this.recipeService.getAll().subscribe((recipes) => {
      const map = new Map<string, Recipe>();
      recipes.forEach((r) => map.set(r.id, r));
      this.recipes.set(map);
    });
  }

  getEntry(day: DayOfWeek, meal: MealType): (MealPlanEntry & { _index: number }) | null {
    const p = this.plan();
    if (!p) return null;
    const idx = p.entries.findIndex((e) => e.day === day && e.meal === meal);
    if (idx === -1) return null;
    return { ...p.entries[idx], _index: idx };
  }

  getRecipeName(recipeId: string): string {
    return this.recipes().get(recipeId)?.name ?? 'Unknown';
  }

  formatDay(day: DayOfWeek): string {
    return day.charAt(0).toUpperCase() + day.slice(1, 3);
  }

  formatMeal(meal: MealType): string {
    return meal.charAt(0).toUpperCase() + meal.slice(1);
  }

  openPicker(day: DayOfWeek, meal: MealType): void {
    this.pickerDay = day;
    this.pickerMeal = meal;
    this.showPicker.set(true);
  }

  closePicker(): void {
    this.showPicker.set(false);
    this.pickerDay = null;
    this.pickerMeal = null;
  }

  onRecipeSelected(recipe: Recipe): void {
    const p = this.plan();
    if (!p || !this.pickerDay || !this.pickerMeal) return;

    this.mealPlanService.addEntry(p.id, {
      day: this.pickerDay,
      meal: this.pickerMeal,
      recipeId: recipe.id,
      servings: recipe.servings,
    }).subscribe((updated) => {
      this.plan.set(updated);
      this.closePicker();
    });
  }

  removeEntry(entry: MealPlanEntry & { _index: number }): void {
    const p = this.plan();
    if (!p) return;
    this.mealPlanService.removeEntry(p.id, entry._index).subscribe((updated) => {
      this.plan.set(updated);
    });
  }

  confirmCooked(entry: MealPlanEntry & { _index: number }): void {
    const p = this.plan();
    if (!p) return;
    this.mealPlanService.confirmCooked(p.id, entry._index).subscribe(() => {
      // Reload plan
      this.mealPlanService.getByWeek(p.weekStartDate).subscribe((updated) => {
        this.plan.set(updated);
      });
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
