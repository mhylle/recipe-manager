import { PantryCategory, Unit } from '../enums/index.js';

export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: Unit;
  /**
   * Which shelf it belongs on, carried from the recipe so that putting the
   * shopping away can file it. Absent on lists written before the column
   * existed, and read as `other` rather than guessed from the name.
   */
  category?: PantryCategory | null;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  mealPlanId: string;
  generatedDate: string;
  /** Set once the shopping is done. Null is the list being shopped from. */
  archivedAt?: string | null;
  items: ShoppingListItem[];
}
