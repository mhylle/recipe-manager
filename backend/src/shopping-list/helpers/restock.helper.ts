import { PantryCategory, Unit } from '../../shared/enums/index.js';
import { convertTo } from './consolidation.helper.js';

/** A line on the shopping list, as far as stocking the pantry is concerned. */
export interface BoughtItem {
  name: string;
  quantity: number;
  unit: Unit;
  /** Absent on lists written before the column existed — those land under `other`. */
  category?: PantryCategory | null;
  checked: boolean;
}

/** What the kitchen already holds. */
export interface HeldItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: PantryCategory;
}

export interface RestockPlan {
  /** Existing shelf entries and their new totals. */
  updates: { id: string; quantity: number }[];
  /** Things the kitchen has never held before. */
  creates: {
    name: string;
    quantity: number;
    unit: Unit;
    category: PantryCategory;
  }[];
}

/**
 * What putting the shopping away does to the pantry.
 *
 * Only ticked-off lines count: an unchecked one was not bought, and stocking it
 * would tell the kitchen it owns something nobody put in the trolley.
 *
 * An amount that can be converted into what the shelf already uses is added to
 * it, in the pantry's own unit — a shop should not reorganise the shelf. One
 * that cannot (two onions against 80 g of onion) starts its own entry rather
 * than inventing the weight of an onion to join them with.
 *
 * Pure, and deliberately so: it decides what somebody owns, and it should be
 * provable without a database anywhere near it.
 */
export function planRestock(
  held: HeldItem[],
  bought: BoughtItem[],
): RestockPlan {
  const plan: RestockPlan = { updates: [], creates: [] };
  // Running totals, so two lines of the same ingredient both land — and so a
  // freshly created entry is not created twice.
  const totals = new Map<string, number>();
  const byName = new Map<string, HeldItem>();
  for (const item of held) {
    byName.set(item.name.trim().toLowerCase(), item);
  }

  for (const item of bought) {
    if (!item.checked) {
      continue;
    }
    const name = item.name.trim();
    const key = name.toLowerCase();
    const shelf = byName.get(key);
    const converted = shelf
      ? convertTo(item.quantity, item.unit, shelf.unit)
      : null;

    if (shelf && converted !== null) {
      const running = totals.get(shelf.id) ?? shelf.quantity;
      totals.set(shelf.id, running + converted);
      continue;
    }

    // Either the kitchen has never held this, or it holds it in a unit this
    // cannot be turned into. Both are a new entry.
    const existing = plan.creates.find(
      (c) => c.name.toLowerCase() === key && c.unit === item.unit,
    );
    if (existing) {
      existing.quantity = round(existing.quantity + item.quantity);
      continue;
    }
    plan.creates.push({
      name,
      quantity: round(item.quantity),
      unit: item.unit,
      // NULL means the list never recorded one. `other` is where an unfiled
      // item belongs, and is better than guessing a shelf from its name.
      category: item.category ?? PantryCategory.OTHER,
    });
  }

  plan.updates = [...totals.entries()].map(([id, quantity]) => ({
    id,
    quantity: round(quantity),
  }));

  return plan;
}

/** Two decimals: 0.1 + 0.2 is 0.30000000000000004, and a shelf should not say so. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
