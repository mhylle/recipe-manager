import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  MealPlanService,
  type AddEntryRequest,
  type DisplaceRequest,
  type MealSlot,
} from '../../../features/meal-plan/meal-plan.service';
import { RecipeService } from '../../../features/recipe/recipe.service';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { MealType } from '../../enums/meal-type.enum';
import { EnumLabelPipe, TranslatePipe, type TranslationKey } from '../../i18n';
import type { MealPlan, MealPlanEntry } from '../../models/meal-plan.model';
import type { Recipe } from '../../models/recipe.model';

/** An entry in a slot, plus the positional index the API addresses it by. */
interface Occupant {
  entry: MealPlanEntry;
  index: number;
  name: string;
}

/** Which question the dialog is currently asking. */
type Step = 'slot' | 'conflict' | 'moveTarget';

/**
 * Plan a recipe into the week, from the recipe itself.
 *
 * The grid shows what is already in each slot, because "when shall I cook this"
 * is not answerable without seeing the week you are answering it for.
 *
 * A slot may legitimately hold more than one meal — a large lunch and a small
 * one are both lunch — so landing on an occupied slot is not an error. It asks:
 * add alongside, replace it, or move the existing meal somewhere else. Only the
 * last needs a second choice, and it is the one that keeps a meal someone still
 * intends to cook.
 */
@Component({
  selector: 'app-plan-recipe-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, EnumLabelPipe],
  templateUrl: './plan-recipe-dialog.html',
  styleUrl: './plan-recipe-dialog.scss',
})
export class PlanRecipeDialogComponent {
  private readonly mealPlans = inject(MealPlanService);
  private readonly recipes = inject(RecipeService);

  private readonly dialogRef =
    viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly recipe = input.required<Recipe>();

  readonly planned = output<MealPlan>();
  readonly cancelled = output<void>();

  readonly days = Object.values(DayOfWeek);
  readonly meals = Object.values(MealType);

  readonly plan = signal<MealPlan | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<TranslationKey | null>(null);
  readonly step = signal<Step>('slot');

  /** The slot being planned into, once chosen. */
  readonly target = signal<MealSlot | null>(null);
  /** What was already there, when the chosen slot was not empty. */
  readonly conflict = signal<Occupant | null>(null);

  /** Recipe names by id, so the grid can label occupied slots. */
  private readonly names = signal<Map<string, string>>(new Map());

  private settled = false;

  readonly weekOf = computed(() => this.plan()?.weekStartDate ?? '');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
    });

    // The plan for the current week, and the names to label it with. The grid
    // is unreadable without the names — "something is here" is not an answer to
    // "what would I be replacing".
    this.mealPlans.getByWeek(mondayOf()).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('plan.errNoKitchen');
        this.loading.set(false);
      },
    });

    this.recipes.getAll().subscribe({
      next: (all) => this.names.set(new Map(all.map((r) => [r.id, r.name]))),
      // Names are a label, not the feature. Losing them leaves the grid usable.
      error: () => this.names.set(new Map()),
    });
  }

  /**
   * The week as a grid of slots, built once per plan change.
   *
   * Computed rather than a method the template calls per cell: there are 28
   * slots and each needs its occupants, a count and a label, so a method would
   * re-scan every entry several times per slot on every change detection pass.
   */
  private readonly grid = computed(() => {
    const names = this.names();
    const byslot = new Map<string, Occupant[]>();
    (this.plan()?.entries ?? []).forEach((entry, index) => {
      const key = `${entry.day}|${entry.meal}`;
      const at = byslot.get(key) ?? [];
      at.push({ entry, index, name: names.get(entry.recipeId) ?? '' });
      byslot.set(key, at);
    });
    return byslot;
  });

  /** Everything planned in a slot, in the order the API indexes it. */
  occupants(day: DayOfWeek, meal: MealType): Occupant[] {
    return this.grid().get(`${day}|${meal}`) ?? [];
  }

  /** Whether a slot already holds a meal. */
  isTaken(day: DayOfWeek, meal: MealType): boolean {
    return this.occupants(day, meal).length > 0;
  }

  /** The first occupant, which is the one the API's index addressing reaches. */
  firstIn(day: DayOfWeek, meal: MealType): Occupant | null {
    return this.occupants(day, meal)[0] ?? null;
  }

  /** How many beyond the first, for the "and N more" line. */
  extraIn(day: DayOfWeek, meal: MealType): number {
    return Math.max(0, this.occupants(day, meal).length - 1);
  }

  /** The slot the displaced meal must not be moved into. */
  isTarget(day: DayOfWeek, meal: MealType): boolean {
    const target = this.target();
    return target?.day === day && target?.meal === meal;
  }

  chooseSlot(day: DayOfWeek, meal: MealType): void {
    this.target.set({ day, meal });
    const here = this.occupants(day, meal);
    if (here.length === 0) {
      this.commit();
      return;
    }
    // Ask rather than assume. The first occupant is the one the API's index
    // addressing reaches, and the one the grid shows.
    this.conflict.set(here[0]);
    this.step.set('conflict');
  }

  /** Keep both meals in the slot. */
  addAlongside(): void {
    this.commit();
  }

  /** Drop the meal that was there. */
  replace(): void {
    const occupant = this.conflict();
    if (!occupant) return;
    this.commit({
      index: occupant.index,
      expectRecipeId: occupant.entry.recipeId,
    });
  }

  /** Keep the displaced meal, somewhere else — the caller picks where. */
  startMove(): void {
    this.step.set('moveTarget');
  }

  chooseMoveTarget(day: DayOfWeek, meal: MealType): void {
    const occupant = this.conflict();
    if (!occupant || this.isTarget(day, meal)) {
      return;
    }
    this.commit({
      index: occupant.index,
      expectRecipeId: occupant.entry.recipeId,
      to: { day, meal },
    });
  }

  private commit(displace?: DisplaceRequest): void {
    const plan = this.plan();
    const target = this.target();
    const recipe = this.recipe();
    if (!plan || !target || this.busy()) {
      return;
    }

    const request: AddEntryRequest = {
      day: target.day,
      meal: target.meal,
      recipeId: recipe.id,
      servings: recipe.servings,
      ...(displace ? { displace } : {}),
    };

    this.busy.set(true);
    this.error.set(null);

    this.mealPlans.addEntry(plan.id, request).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.settled = true;
        this.close();
        this.planned.emit(updated);
      },
      error: (err: { status?: number }) => {
        this.busy.set(false);
        // 409 means the plan moved under us — the server refused rather than
        // displacing whatever had shifted into that position.
        this.error.set(
          err.status === 409 ? 'plan.errStale' : 'plan.errFailed',
        );
        this.step.set('slot');
      },
    });
  }

  back(): void {
    this.conflict.set(null);
    this.target.set(null);
    this.step.set('slot');
  }

  cancel(): void {
    if (this.settled) return;
    this.close();
    this.cancelled.emit();
  }

  private close(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog?.open) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }
}

/**
 * The Monday of the current week, which is how a plan is keyed.
 *
 * Local date parts, not toISOString: that converts to UTC first, so late on a
 * Sunday evening in a positive offset it would name next week's Monday.
 */
function mondayOf(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is 0 for Sunday, which is 6 days after the Monday that owns it.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
