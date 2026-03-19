import { Unit } from '../../shared/enums/index.js';

export interface ConsolidatedItem {
  name: string;
  quantity: number;
  unit: Unit;
}

export function consolidateIngredients(
  items: ConsolidatedItem[],
): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem>();

  for (const item of items) {
    const key = `${item.name.toLowerCase().trim()}|${item.unit}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, {
        name: item.name.trim(),
        quantity: item.quantity,
        unit: item.unit,
      });
    }
  }

  return Array.from(map.values());
}
