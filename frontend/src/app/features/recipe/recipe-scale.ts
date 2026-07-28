import type { RecipeIngredient } from '../../shared/models/recipe.model';

/** Multipliers offered as one-tap buttons. 1 is included so there is a way back. */
export const SCALE_PRESETS = [0.5, 1, 1.5, 2, 3] as const;

export type ScaleSelection =
  | { mode: 'servings'; servings: number }
  | { mode: 'multiplier'; multiplier: number };

/**
 * How much to multiply every quantity by.
 *
 * Guards against the two inputs that would otherwise render nonsense: a recipe
 * stored with `servings: 0` (division by zero → Infinity → "∞ g flour") and a
 * target of zero or negative servings.
 */
export function scaleFactor(selection: ScaleSelection, baseServings: number): number {
  const factor =
    selection.mode === 'servings'
      ? baseServings > 0
        ? selection.servings / baseServings
        : 1
      : selection.multiplier;

  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/**
 * Scale one quantity for display.
 *
 * At factor 1 the original value is returned untouched — an unscaled recipe
 * shows exactly what its author wrote, rather than a rounded approximation that
 * happens to look the same most of the time.
 *
 * Otherwise the result is rounded to two decimals, which is enough for cooking
 * and hides IEEE 754 noise (0.1 × 3 is 0.30000000000000004). Values that would
 * round to zero keep more precision instead: half a pinch is still a pinch, and
 * showing "0 g" would be worse than showing "0.005 g".
 */
export function scaleQuantity(quantity: number, factor: number): number {
  if (factor === 1) {
    return quantity;
  }

  const scaled = quantity * factor;
  const rounded = Math.round(scaled * 100) / 100;
  if (rounded !== 0) {
    return rounded;
  }
  return scaled === 0 ? 0 : Number(scaled.toPrecision(2));
}

/** A copy of the ingredients with quantities scaled. Units and names are untouched. */
export function scaleIngredients(
  ingredients: readonly RecipeIngredient[],
  factor: number,
): RecipeIngredient[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleQuantity(ingredient.quantity, factor),
  }));
}
