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
      <h2>Meal Plan - Week of {{ currentWeek() }}</h2>

      <div class="grid-container">
        <table class="meal-grid" aria-label="Weekly meal plan">
          <thead>
            <tr>
              <th scope="col">Meal</th>
              @for (day of days; track day) {
                <th scope="col">{{ formatDay(day) }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (meal of meals; track meal) {
              <tr>
                <th scope="row" class="meal-label">{{ formatMeal(meal) }}</th>
                @for (day of days; track day) {
                  <td class="meal-cell">
                    @if (getEntry(day, meal); as entry) {
                      <div class="meal-cell__content">
                        <span class="meal-cell__name">{{ getRecipeName(entry.recipeId) }}</span>
                        <span class="meal-cell__servings">{{ entry.servings }} srv</span>
                        <div class="meal-cell__actions">
                          <button type="button" class="btn-icon" (click)="confirmCooked(entry)" [attr.aria-label]="'Mark as cooked: ' + getRecipeName(entry.recipeId)">Done</button>
                          <button type="button" class="btn-icon btn-icon--danger" (click)="removeEntry(entry)" [attr.aria-label]="'Remove ' + getRecipeName(entry.recipeId)">X</button>
                        </div>
                      </div>
                    } @else {
                      <button type="button" class="meal-cell__add" (click)="openPicker(day, meal)" [attr.aria-label]="'Add recipe for ' + formatDay(day) + ' ' + formatMeal(meal)">+</button>
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
    .meal-plan { max-width: 1100px; }
    .grid-container { overflow-x: auto; }
    .meal-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .meal-grid th, .meal-grid td { border: 1px solid #e0e0e0; padding: 0.5rem; text-align: center; vertical-align: top; }
    .meal-grid thead th { background: #f5f5f5; font-size: 0.8125rem; text-transform: capitalize; }
    .meal-label { background: #f5f5f5; font-size: 0.8125rem; text-transform: capitalize; width: 80px; }
    .meal-cell { min-height: 70px; position: relative; }
    .meal-cell__content { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem; }
    .meal-cell__name { font-weight: 500; color: #1976d2; }
    .meal-cell__servings { color: #888; font-size: 0.75rem; }
    .meal-cell__actions { display: flex; gap: 0.25rem; justify-content: center; }
    .meal-cell__add { width: 100%; height: 60px; border: 2px dashed #ccc; background: transparent; cursor: pointer; font-size: 1.5rem; color: #999; border-radius: 4px; }
    .meal-cell__add:hover { border-color: #1976d2; color: #1976d2; }
    .btn-icon { padding: 0.125rem 0.375rem; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer; font-size: 0.6875rem; }
    .btn-icon:hover { background: #e8f5e9; }
    .btn-icon--danger:hover { background: #fce4ec; }
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
