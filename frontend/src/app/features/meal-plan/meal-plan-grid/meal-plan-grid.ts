import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { MealPlanService } from '../meal-plan.service';
import { RecipeService } from '../../recipe/recipe.service';
import { MealPlan, MealPlanEntry } from '../../../shared/models/meal-plan.model';
import { Recipe } from '../../../shared/models/recipe.model';
import { DayOfWeek } from '../../../shared/enums/day-of-week.enum';
import { MealType } from '../../../shared/enums/meal-type.enum';
import { RecipePickerDialogComponent } from '../recipe-picker-dialog/recipe-picker-dialog';
import {
  EnumLabelPipe,
  LocaleService,
  TranslatePipe,
  reloadOnLocaleChange,
} from '../../../shared/i18n';

@Component({
  selector: 'app-meal-plan-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecipePickerDialogComponent, TranslatePipe, EnumLabelPipe],
  templateUrl: './meal-plan-grid.html',
  styleUrl: './meal-plan-grid.scss',
})
export class MealPlanGridComponent {
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly locale = inject(LocaleService);

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

  // Re-fetches on every language switch; recipe names are localised server-side.
  private readonly reload = reloadOnLocaleChange(() => this.loadPlan());

  private loadPlan(): void {
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
    return this.recipes().get(recipeId)?.name ?? this.locale.translate('common.unknown');
  }

  /**
   * Composed here rather than concatenated in the template so the day and meal
   * read in the active language and word order stays the translator's choice.
   */
  addRecipeLabel(day: DayOfWeek, meal: MealType): string {
    return this.locale.translate('mealPlan.addFor', {
      day: this.locale.translate(`enum.dayOfWeek.${day}`),
      meal: this.locale.translate(`enum.mealType.${meal}`),
    });
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
