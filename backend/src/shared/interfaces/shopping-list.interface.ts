import { Unit } from '../enums/index.js';

export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: Unit;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  mealPlanId: string;
  generatedDate: string;
  items: ShoppingListItem[];
}
