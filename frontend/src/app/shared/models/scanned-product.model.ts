import { PantryCategory } from '../enums/pantry-category.enum';
import { Unit } from '../enums/unit.enum';

/** A barcode, as far as an open food database knows it. */
export interface ScannedProduct {
  barcode: string;
  name: string;
  category: PantryCategory;
  /**
   * Null when the packaging size is missing or in a unit we do not keep — a
   * six-pack in centilitres, say. Never defaulted to 1: telling a kitchen it
   * owns one of something nobody measured is worse than leaving the box empty.
   */
  quantity: number | null;
  unit: Unit | null;
}
