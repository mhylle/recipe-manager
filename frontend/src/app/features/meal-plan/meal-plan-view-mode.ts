import type { TranslationKey } from '../../shared/i18n';

/**
 * How the week is laid out.
 *
 * - `compact` — the original: a 7x4 table on a desktop, a day list on a phone.
 *   Dense, and the right answer when the question is "what does the week look
 *   like".
 * - `visual`  — a day per column, each meal a card carrying its photograph. The
 *   question it answers is "what are we actually eating", which names alone do
 *   not answer well.
 */
export type MealPlanViewMode = 'compact' | 'visual';

export interface MealPlanViewModeOption {
  readonly value: MealPlanViewMode;
  readonly labelKey: TranslationKey;
}

export const MEAL_PLAN_VIEW_MODES: readonly MealPlanViewModeOption[] = [
  { value: 'compact', labelKey: 'mealPlan.view.compact' },
  { value: 'visual', labelKey: 'mealPlan.view.visual' },
];

/** The existing layout stays the default — this adds a choice, not a change. */
export const DEFAULT_MEAL_PLAN_VIEW_MODE: MealPlanViewMode = 'compact';

export const MEAL_PLAN_VIEW_MODE_STORAGE_KEY = 'recipe-manager.mealPlanViewMode';

export function isMealPlanViewMode(value: unknown): value is MealPlanViewMode {
  return MEAL_PLAN_VIEW_MODES.some((m) => m.value === value);
}

/** localStorage throws in some privacy modes; no stored preference is not an error. */
export function readStoredMealPlanViewMode(): MealPlanViewMode {
  try {
    const stored = localStorage.getItem(MEAL_PLAN_VIEW_MODE_STORAGE_KEY);
    return isMealPlanViewMode(stored) ? stored : DEFAULT_MEAL_PLAN_VIEW_MODE;
  } catch {
    return DEFAULT_MEAL_PLAN_VIEW_MODE;
  }
}

export function writeStoredMealPlanViewMode(mode: MealPlanViewMode): void {
  try {
    localStorage.setItem(MEAL_PLAN_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // The preference simply will not survive the session.
  }
}
