import type { Unit, PantryCategory } from '../shared/enums/index.js';

/** One step of the base method, before any variation touches it. */
export interface BaseStep {
  id: string;
  text: string;
  imageUrl: string | null;
}

/** One ingredient of the base recipe. */
export interface BaseIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
}

/** What a variation does to one ingredient. */
export interface VariationIngredientChange {
  /** The base ingredient it changes. Null adds one. */
  ingredientId: string | null;
  removed: boolean;
  name: string | null;
  quantity: number | null;
  unit: Unit | null;
  pantryCategory: PantryCategory | null;
  sortOrder: number;
}

/** What a variation does to one step. */
export interface VariationStepChange {
  /** The base step it replaces. Null inserts one. */
  stepId: string | null;
  removed: boolean;
  text: string | null;
  /** Where an inserted step goes: after this many base steps. */
  afterPosition: number | null;
}

export interface ResolvedVariation {
  id: string;
  name: string;
  note: string;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: VariationIngredientChange[];
  steps: VariationStepChange[];
}

export interface VariedRecipe {
  ingredients: BaseIngredient[];
  steps: BaseStep[];
  prepTime: number;
  cookTime: number;
}

/**
 * The recipe as this variation would have you cook it.
 *
 * A variation stores only differences, so this is where "1 g of yeast and
 * sixteen hours" and "10 g and two" become two complete recipes without either
 * being written out twice. Everything downstream — the page, the shopping list,
 * the scaler — reads the result and never learns a variation was involved.
 *
 * Pure, and deliberately so: it is the one piece of this feature that decides
 * what somebody actually cooks and buys, and it should be testable without a
 * database anywhere near it.
 */
export function applyVariation(
  base: VariedRecipe,
  variation: ResolvedVariation | null,
): VariedRecipe {
  if (!variation) {
    return base;
  }

  return {
    ingredients: applyIngredients(base.ingredients, variation.ingredients),
    steps: applySteps(base.steps, variation.steps),
    // Null inherits. Zero does not — a variation may legitimately say a step
    // takes no time, and `??` keeps that distinct from "unset" where `||`
    // would quietly swallow it.
    prepTime: variation.prepTime ?? base.prepTime,
    cookTime: variation.cookTime ?? base.cookTime,
  };
}

function applyIngredients(
  base: BaseIngredient[],
  changes: VariationIngredientChange[],
): BaseIngredient[] {
  const byId = new Map(
    changes.filter((c) => c.ingredientId).map((c) => [c.ingredientId, c]),
  );

  const kept = base
    .filter((ing) => !byId.get(ing.id)?.removed)
    .map((ing) => {
      const change = byId.get(ing.id);
      if (!change) return ing;
      return {
        ...ing,
        // Each field falls back independently: changing the yeast to 10 g must
        // not blank its unit or its name.
        name: change.name ?? ing.name,
        quantity: change.quantity ?? ing.quantity,
        unit: change.unit ?? ing.unit,
        pantryCategory: change.pantryCategory ?? ing.pantryCategory,
      };
    });

  // Added ones go last, in the author's order. The ciabatta's sugar and the
  // teriyaki's garlic are in no base list, so without this the shopping is
  // wrong in exactly the way the reports complained about.
  const added = changes
    .filter((c) => !c.ingredientId && !c.removed)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c, index) => ({
      id: `added:${index}`,
      name: c.name ?? '',
      quantity: c.quantity ?? 0,
      unit: c.unit as Unit,
      pantryCategory: c.pantryCategory as PantryCategory,
    }));

  return [...kept, ...added];
}

function applySteps(
  base: BaseStep[],
  changes: VariationStepChange[],
): BaseStep[] {
  const byId = new Map(
    changes.filter((c) => c.stepId).map((c) => [c.stepId, c]),
  );

  const kept = base
    .filter((step) => !byId.get(step.id)?.removed)
    .map((step) => {
      const change = byId.get(step.id);
      // Replacing the text keeps the photograph: the same pot at the same
      // moment, described differently.
      return change?.text ? { ...step, text: change.text } : step;
    });

  const inserted = changes
    .filter((c) => !c.stepId && !c.removed && c.text)
    .sort((a, b) => (a.afterPosition ?? 0) - (b.afterPosition ?? 0));

  if (inserted.length === 0) {
    return kept;
  }

  // `afterPosition` counts BASE steps, not the filtered list, so it still means
  // the same place when a variation also removes one. Walking the base and
  // emitting insertions as their position is passed keeps that true.
  const out: BaseStep[] = [];
  let cursor = 0;
  const emitUpTo = (position: number) => {
    while (
      cursor < inserted.length &&
      (inserted[cursor].afterPosition ?? 0) <= position
    ) {
      const step = inserted[cursor];
      out.push({
        id: `inserted:${cursor}`,
        text: step.text ?? '',
        imageUrl: null,
      });
      cursor++;
    }
  };

  emitUpTo(0);
  base.forEach((step, index) => {
    if (!byId.get(step.id)?.removed) {
      const change = byId.get(step.id);
      out.push(change?.text ? { ...step, text: change.text } : step);
    }
    emitUpTo(index + 1);
  });
  emitUpTo(Number.MAX_SAFE_INTEGER);

  return out;
}
