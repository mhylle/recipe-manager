import { PantryCategory, Unit } from '../../shared/enums/index.js';

export interface ConsolidatedItem {
  name: string;
  quantity: number;
  unit: Unit;
  /** The shelf this belongs on, carried through so the pantry can be stocked. */
  category?: PantryCategory | null;
}

/**
 * How to add one unit to another.
 *
 * `dimension` is what makes two amounts addable at all: millilitres and
 * teaspoons both measure volume, so they combine; grams and a count of onions
 * do not, whatever a shopping list would prefer. `perBase` is how many of the
 * dimension's smallest unit one of these is.
 *
 * PIECE and PINCH are deliberately absent. A pinch is a gesture rather than a
 * measurement, and turning it into 0.2 tsp would state a precision the recipe
 * never had; a piece needs to know what one onion weighs, which is a fact this
 * app does not have and should not invent.
 */
const SCALE: Partial<Record<Unit, { dimension: string; perBase: number }>> = {
  [Unit.ML]: { dimension: 'volume', perBase: 1 },
  [Unit.TSP]: { dimension: 'volume', perBase: 5 },
  [Unit.TBSP]: { dimension: 'volume', perBase: 15 },
  [Unit.L]: { dimension: 'volume', perBase: 1000 },
  [Unit.G]: { dimension: 'mass', perBase: 1 },
  [Unit.KG]: { dimension: 'mass', perBase: 1000 },
};

/**
 * The same amount expressed in another unit, or null when that is not a
 * question with an answer.
 *
 * Null is the honest result for grams into pieces: it needs to know what one
 * onion weighs, and every caller would rather keep the two apart than have a
 * number invented for them.
 */
export function convertTo(
  quantity: number,
  from: Unit,
  to: Unit,
): number | null {
  if (from === to) {
    return quantity;
  }
  const source = SCALE[from];
  const target = SCALE[to];
  if (!source || !target || source.dimension !== target.dimension) {
    return null;
  }
  return (quantity * source.perBase) / target.perBase;
}

interface Bucket {
  name: string;
  category?: PantryCategory | null;
  /** The amount so far, in the dimension's smallest unit. */
  base: number;
  /** The smallest unit actually seen, which is what this will be shown in. */
  unit: Unit;
  perBase: number;
}

/**
 * One line per ingredient per KIND of measurement.
 *
 * Keyed on name and unit, the same ingredient measured two ways never met:
 * "2 list items of white onion" was 2 piece from one recipe and 80 g from
 * another. Amounts that measure the same thing are now converted and added, and
 * the ones that genuinely cannot be added survive as they are — the list groups
 * them under a single name rather than inventing a number to join them with.
 */
export function consolidateIngredients(
  items: ConsolidatedItem[],
): ConsolidatedItem[] {
  const buckets = new Map<string, Bucket>();

  for (const item of items) {
    const name = item.name.trim();
    const scale = SCALE[item.unit];
    // Unconvertible units keep the unit itself in the key, so a count stays a
    // count. Convertible ones share one bucket per dimension.
    const key = `${name.toLowerCase()}|${scale ? scale.dimension : item.unit}`;

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        name,
        category: item.category,
        base: item.quantity * (scale?.perBase ?? 1),
        unit: item.unit,
        perBase: scale?.perBase ?? 1,
      });
      continue;
    }

    existing.base += item.quantity * (scale?.perBase ?? 1);
    // First one that names a shelf wins: two recipes agreeing on the ingredient
    // and disagreeing on the shelf is not worth a tie-break rule.
    existing.category = existing.category ?? item.category;
    // Show the result in the SMALLEST unit that was asked for. Keeping the
    // first one instead turns a teaspoon into a third of a tablespoon, which is
    // a worse thing to read standing in a shop.
    if (scale && scale.perBase < existing.perBase) {
      existing.unit = item.unit;
      existing.perBase = scale.perBase;
    }
  }

  return [...buckets.values()].map((bucket) => ({
    name: bucket.name,
    category: bucket.category,
    // Two decimals, because 0.1 + 0.2 is 0.30000000000000004 in floating point
    // and a list that says so has lost the reader over nothing.
    quantity: Math.round((bucket.base / bucket.perBase) * 100) / 100,
    unit: bucket.unit,
  }));
}
