import { mondayOf } from '../../../shared/utils/week';
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
} from '../../../shared/i18n';
import { reloadOnKitchenChange } from '../../../shared/services/reload-on-kitchen-change';
import { RouterLink } from '@angular/router';

/** A planned meal plus the position the API addresses it by. */
export type PlannedEntry = MealPlanEntry & { _index: number };

/** Shared so an empty slot keeps one array identity across change detection. */
const NO_ENTRIES: readonly PlannedEntry[] = [];

const slotKey = (day: DayOfWeek, meal: MealType): string => `${day}|${meal}`;

@Component({
  selector: 'app-meal-plan-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecipePickerDialogComponent, TranslatePipe, EnumLabelPipe, RouterLink],
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

  /** False when there is no kitchen to plan for — signed out, or no pantry. */
  readonly kitchenAvailable = signal(true);

  readonly currentWeek = computed(() => {
    const p = this.plan();
    return p ? p.weekStartDate : '';
  });

  // Re-fetches on every language switch; recipe names are localised server-side.
  private readonly reload = reloadOnKitchenChange(() => this.loadPlan());

  private loadPlan(): void {
    const weekStart = mondayOf();
    this.mealPlanService.getByWeek(weekStart).subscribe({
      next: (plan) => {
        this.kitchenAvailable.set(true);
        this.plan.set(plan);
      },
      error: () => {
        // A plan belongs to a kitchen. Without one there is nothing to show,
        // and seven days of "+ Breakfast" chips that all fail on tap is worse
        // than saying so.
        this.kitchenAvailable.set(false);
        this.plan.set(null);
      },
    });
    this.recipeService.getAll().subscribe((recipes) => {
      const map = new Map<string, Recipe>();
      recipes.forEach((r) => map.set(r.id, r));
      this.recipes.set(map);
    });
  }

  /**
   * Every entry, grouped by the slot it sits in.
   *
   * A slot holds a list, not one meal: a large lunch and a small one are both
   * lunch, and the API has always allowed it. Resolving a slot with findIndex is
   * what made everything after the first invisible.
   *
   * `_index` is the entry's position in the WHOLE plan, because that is what the
   * API removes and confirms by. Numbering within the slot would address the
   * wrong meal the moment another day's entry sits between two of them.
   */
  private readonly slots = computed(() => {
    const p = this.plan();
    const map = new Map<string, PlannedEntry[]>();
    if (!p) return map;
    p.entries.forEach((entry, index) => {
      const key = slotKey(entry.day, entry.meal);
      map.set(key, [...(map.get(key) ?? []), { ...entry, _index: index }]);
    });
    return map;
  });

  entriesFor(day: DayOfWeek, meal: MealType): readonly PlannedEntry[] {
    return this.slots().get(slotKey(day, meal)) ?? NO_ENTRIES;
  }

  getRecipeName(recipeId: string): string {
    return this.recipes().get(recipeId)?.name ?? this.locale.translate('common.unknown');
  }

  /**
   * Whether the recipe behind an entry is one we can actually open.
   *
   * A plan can outlive the recipe it points at, and it can name one that lives
   * in a kitchen this account cannot read. Linking to a page that will 404 is
   * worse than leaving the row as plain text.
   */
  knowsRecipe(recipeId: string): boolean {
    return this.recipes().has(recipeId);
  }

  /**
   * Composed here rather than concatenated in the template so the day and meal
   * read in the active language and word order stays the translator's choice.
   *
   * An occupied slot says "add another": the slot is not full, and a plain "add"
   * on a slot that already shows a meal reads like a mistake.
   */
  addLabel(day: DayOfWeek, meal: MealType): string {
    const key = this.entriesFor(day, meal).length
      ? 'mealPlan.addAnotherFor'
      : 'mealPlan.addFor';
    return this.locale.translate(key, {
      day: this.locale.translate(`enum.dayOfWeek.${day}`),
      meal: this.locale.translate(`enum.mealType.${meal}`),
    });
  }

  /**
   * Everything planned for a day, in meal order — what the phone layout leads
   * with. Flat rather than grouped: two dinners are two cards, each carrying its
   * own meal pill and its own actions.
   */
  plannedFor(day: DayOfWeek): { meal: MealType; entry: PlannedEntry }[] {
    return this.meals.flatMap((meal) =>
      this.entriesFor(day, meal).map((entry) => ({ meal, entry })),
    );
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

  removeEntry(entry: PlannedEntry): void {
    const p = this.plan();
    if (!p) return;
    this.mealPlanService.removeEntry(p.id, entry._index).subscribe((updated) => {
      this.plan.set(updated);
    });
  }

  confirmCooked(entry: PlannedEntry): void {
    const p = this.plan();
    if (!p) return;
    this.mealPlanService.confirmCooked(p.id, entry._index).subscribe(() => {
      // Reload plan
      this.mealPlanService.getByWeek(p.weekStartDate).subscribe((updated) => {
        this.plan.set(updated);
      });
    });
  }

}
