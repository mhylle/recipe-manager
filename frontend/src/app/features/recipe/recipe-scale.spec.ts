import { describe, it, expect } from 'vitest';
import { SCALE_PRESETS, scaleFactor, scaleIngredients, scaleQuantity } from './recipe-scale';
import type { RecipeIngredient } from '../../shared/models/recipe.model';
import { Unit } from '../../shared/enums/unit.enum';
import { PantryCategory } from '../../shared/enums/pantry-category.enum';

const ingredient = (quantity: number, unit = Unit.G): RecipeIngredient => ({
  name: 'Plain Flour',
  quantity,
  unit,
  pantryCategory: PantryCategory.BAKING,
});

describe('scaleFactor', () => {
  it('derives a factor from target servings', () => {
    expect(scaleFactor({ mode: 'servings', servings: 8 }, 4)).toBe(2);
    expect(scaleFactor({ mode: 'servings', servings: 2 }, 4)).toBe(0.5);
  });

  it('uses the multiplier directly', () => {
    expect(scaleFactor({ mode: 'multiplier', multiplier: 1.5 }, 4)).toBe(1.5);
  });

  it('falls back to 1 when the base servings are missing or zero', () => {
    // A recipe with servings: 0 would otherwise produce Infinity and render
    // every quantity as "∞".
    expect(scaleFactor({ mode: 'servings', servings: 8 }, 0)).toBe(1);
  });

  it('never returns a non-positive factor', () => {
    expect(scaleFactor({ mode: 'servings', servings: 0 }, 4)).toBe(1);
    expect(scaleFactor({ mode: 'servings', servings: -2 }, 4)).toBe(1);
    expect(scaleFactor({ mode: 'multiplier', multiplier: 0 }, 4)).toBe(1);
  });
});

describe('scaleQuantity', () => {
  it('returns the ORIGINAL value untouched at factor 1', () => {
    // The identity case matters: an unscaled recipe must show exactly what the
    // author wrote, not a rounded approximation of it. 0.125 tsp must not
    // become 0.13 tsp just because the page rendered.
    expect(scaleQuantity(0.125, 1)).toBe(0.125);
    expect(scaleQuantity(360, 1)).toBe(360);
    expect(scaleQuantity(33.333, 1)).toBe(33.333);
  });

  it('scales and rounds to a sane precision', () => {
    expect(scaleQuantity(500, 2)).toBe(1000);
    expect(scaleQuantity(12, 1.5)).toBe(18);
    expect(scaleQuantity(100, 0.5)).toBe(50);
  });

  it('rounds awkward results rather than showing float noise', () => {
    // 0.1 * 3 is 0.30000000000000004 in IEEE 754.
    expect(scaleQuantity(0.1, 3)).toBe(0.3);
    expect(scaleQuantity(1, 1 / 3)).toBe(0.33);
  });

  it('keeps small quantities visible instead of rounding them to zero', () => {
    // A pinch halved is still a pinch. Rounding to 2dp would give 0.
    expect(scaleQuantity(0.01, 0.5)).toBeGreaterThan(0);
  });
});

describe('scaleIngredients', () => {
  const ingredients = [ingredient(500), ingredient(24), ingredient(0.5, Unit.TSP)];

  it('scales every quantity', () => {
    const scaled = scaleIngredients(ingredients, 2);
    expect(scaled.map((i) => i.quantity)).toEqual([1000, 48, 1]);
  });

  it('never changes unit, name or category', () => {
    // Scaling is arithmetic on one field. Converting 1000 g to 1 kg would be a
    // different feature, and silently changing a category would corrupt the
    // shopping list grouping.
    const scaled = scaleIngredients(ingredients, 3);
    scaled.forEach((s, i) => {
      expect(s.unit).toBe(ingredients[i].unit);
      expect(s.name).toBe(ingredients[i].name);
      expect(s.pantryCategory).toBe(ingredients[i].pantryCategory);
    });
  });

  it('does not mutate the input', () => {
    const original = [ingredient(500)];
    scaleIngredients(original, 4);
    expect(original[0].quantity).toBe(500);
  });

  it('returns the same values at factor 1', () => {
    expect(scaleIngredients(ingredients, 1).map((i) => i.quantity)).toEqual([500, 24, 0.5]);
  });
});

describe('SCALE_PRESETS', () => {
  it('includes 1 so there is always a way back to the original', () => {
    expect(SCALE_PRESETS).toContain(1);
  });

  it('is sorted, so the control reads left to right', () => {
    expect([...SCALE_PRESETS].sort((a, b) => a - b)).toEqual([...SCALE_PRESETS]);
  });
});
