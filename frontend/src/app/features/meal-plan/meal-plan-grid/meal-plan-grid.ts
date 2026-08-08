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
import { Router, RouterLink } from '@angular/router';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';

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
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly router = inject(Router);
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

  readonly buildingList = signal(false);
  readonly listFailed = signal(false);

  /** The meal being moved, while the reader picks where it goes. */
  readonly moving = signal<PlannedEntry | null>(null);
  readonly moveError = signal<'mealPlan.moveStale' | 'mealPlan.moveFailed' | null>(null);

  /** Nothing planned is nothing to shop for, so the button stays away. */
  readonly hasPlannedMeals = computed(() => (this.plan()?.entries.length ?? 0) > 0);

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

  /**
   * Which label the button carries. A method rather than a ternary in the
   * template so the return type is the literal union the `t` pipe is typed
   * against — a typo'd key fails to compile instead of rendering as itself.
   */
  shoppingButtonKey(): 'shoppingList.generating' | 'mealPlan.makeShoppingList' {
    return this.buildingList() ? 'shoppingList.generating' : 'mealPlan.makeShoppingList';
  }

  /**
   * Build this week's shopping list and open it.
   *
   * You decide you need to shop while looking at the week; until now the only
   * button for it was on the shopping list page, which is the one place you go
   * *after* having decided.
   */
  makeShoppingList(): void {
    const p = this.plan();
    if (!p || this.buildingList()) return;
    this.buildingList.set(true);
    this.listFailed.set(false);
    this.shoppingListService.generate(p.id).subscribe({
      next: (list) => {
        this.buildingList.set(false);
        // The list just created, not whatever the shopping page would load on
        // its own — otherwise pressing this can show you last week's.
        this.router.navigate(['/shopping-list'], { queryParams: { id: list.id } });
      },
      error: () => {
        this.buildingList.set(false);
        this.listFailed.set(true);
      },
    });
  }

  /** Start moving a meal. Nothing is written until a destination is chosen. */
  startMove(entry: PlannedEntry): void {
    this.moveError.set(null);
    this.moving.set(entry);
  }

  cancelMove(): void {
    this.moving.set(null);
  }

  /** The slot a meal is already in is not somewhere to move it. */
  isMoveOrigin(day: DayOfWeek, meal: MealType): boolean {
    const m = this.moving();
    return m !== null && m.day === day && m.meal === meal;
  }

  moveLabel(day: DayOfWeek, meal: MealType): string {
    const m = this.moving();
    return this.locale.translate('mealPlan.moveHereFor', {
      recipe: m ? this.getRecipeName(m.recipeId) : '',
      day: this.locale.translate(`enum.dayOfWeek.${day}`),
      meal: this.locale.translate(`enum.mealType.${meal}`),
    });
  }

  /** What the banner says while a destination is being chosen. */
  movingLabel(): string {
    const m = this.moving();
    return this.locale.translate('mealPlan.movingRecipe', {
      recipe: m ? this.getRecipeName(m.recipeId) : '',
    });
  }

  moveTo(day: DayOfWeek, meal: MealType): void {
    const p = this.plan();
    const entry = this.moving();
    if (!p || !entry || this.isMoveOrigin(day, meal)) return;

    this.mealPlanService
      .moveEntry(p.id, entry._index, {
        day,
        meal,
        // What we believe sits at that position. The server refuses rather than
        // moving whatever a housemate's edit has shifted into it.
        expectRecipeId: entry.recipeId,
      })
      .subscribe({
        next: (updated) => {
          this.moving.set(null);
          this.plan.set(updated);
        },
        error: (err: { status?: number }) => {
          this.moving.set(null);
          this.moveError.set(
            err.status === 409 ? 'mealPlan.moveStale' : 'mealPlan.moveFailed',
          );
          // On 409 what is on screen is already wrong; reload rather than let
          // the next click act on positions that have moved.
          if (err.status === 409) this.loadPlan();
        },
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
