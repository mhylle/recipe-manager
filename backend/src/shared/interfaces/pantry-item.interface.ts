import { PantryCategory } from '../enums/index.js';
import { Unit } from '../enums/index.js';

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
