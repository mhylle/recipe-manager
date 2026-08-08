import type { Unit, PantryCategory } from '../shared/enums/index.js';

/**
 * A recipe's variations as the AUTHOR needs them, rather than as a reader does.
 *
 * A reader is served one language with the variation already applied — which is
 * exactly what an editing form cannot use. Recovering "which two of the eighteen
 * steps does this variation change" from a resolved payload would mean comparing
 * text against the base, and text that happens to match is not the same fact as
 * a step that was never overridden. So the differences travel as themselves:
 * every language, each one keyed by the id it points at.
 */

export interface LocalisedText {
  locale: string;
  text: string;
}

export interface LocalisedName {
  locale: string;
  name: string;
}

/** One step of the base method, with the id an override has to name. */
export interface AuthoringBaseStep {
  id: string;
  texts: LocalisedText[];
}

/** One ingredient of the base recipe, with the id a change has to name. */
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
  /** The name of an ADDED ingredient, per language. Empty for a change. */
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

/** Everything the form needs to edit a recipe's variations, in one read. */
export interface RecipeVariationsAuthoring {
  baseIngredients: AuthoringBaseIngredient[];
  baseSteps: AuthoringBaseStep[];
  variations: AuthoringVariation[];
}
