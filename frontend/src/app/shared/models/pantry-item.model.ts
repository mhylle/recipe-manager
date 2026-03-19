import { PantryCategory } from '../enums/pantry-category.enum';
import { Unit } from '../enums/unit.enum';

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: PantryCategory;
  barcode?: string;
  expiryDate?: string;
  addedDate: string;
  lastUpdated: string;
}
