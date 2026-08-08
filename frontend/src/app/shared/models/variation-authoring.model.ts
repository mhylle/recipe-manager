import { PantryCategory } from '../enums/pantry-category.enum';
import { Unit } from '../enums/unit.enum';

/**
 * A recipe's variations as their AUTHOR needs them.
 *
 * The recipe payload serves a reader: one language, with the variation already
 * applied. That is the wrong shape for editing, because a resolved recipe no
 * longer says WHICH of eighteen steps a variation changes — recovering that by
 * comparing text is precisely how all eighteen end up overridden.
 *
 * So the differences travel as themselves: every language, each keyed by the id
 * it points at.
 */

export interface LocalisedText {
  locale: string;
  text: string;
}

export interface LocalisedName {
  locale: string;
  name: string;
}

export interface AuthoringBaseStep {
  id: string;
  texts: LocalisedText[];
}

export interface AuthoringBaseIngredient {
  id: string;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
  names: LocalisedName[];
}

export interface AuthoringVariationIngredient {
  /** The base ingredient this changes. Null adds one. */
  ingredientId: string | null;
  removed: boolean;
  quantity: number | null;
  unit: Unit | null;
  pantryCategory: PantryCategory | null;
  sortOrder: number;
  names: LocalisedName[];
}

export interface AuthoringVariationStep {
  /** The base step this replaces. Null inserts one. */
  stepId: string | null;
  removed: boolean;
  afterPosition: number | null;
  texts: LocalisedText[];
}

export interface AuthoringVariation {
  id: string;
  sortOrder: number;
  prepTime: number | null;
  cookTime: number | null;
  texts: { locale: string; name: string; note: string }[];
  ingredients: AuthoringVariationIngredient[];
  steps: AuthoringVariationStep[];
}

export interface RecipeVariationsAuthoring {
  baseIngredients: AuthoringBaseIngredient[];
  baseSteps: AuthoringBaseStep[];
  variations: AuthoringVariation[];
}

/* ------------------------------------------------------------------ writes */

export interface VariationIngredientWrite {
  ingredientId?: string;
  removed?: boolean;
  quantity?: number;
  unit?: Unit;
  pantryCategory?: PantryCategory;
  sortOrder?: number;
  names?: LocalisedName[];
}

export interface VariationStepWrite {
  stepId?: string;
  removed?: boolean;
  afterPosition?: number;
  texts?: LocalisedText[];
}

export interface VariationWrite {
  /**
   * Which existing variation this is. Absent adds one.
   *
   * Sent back so a save UPDATES the variation rather than replacing it: a meal
   * plan entry points at this id, and recreating the row would turn every
   * dinner already planned this way back into the recipe as written.
   */
  id?: string;
  sortOrder?: number;
  prepTime?: number;
  cookTime?: number;
  texts: { locale: string; name: string; note: string }[];
  ingredients?: VariationIngredientWrite[];
  steps?: VariationStepWrite[];
}
