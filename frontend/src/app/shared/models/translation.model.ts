import type { Locale } from '../i18n';

/** One language's worth of recipe prose. Mirrors the backend's RecipeTranslationInput. */
export interface RecipeTranslation {
  locale: Locale;
  name: string;
  description: string;
  instructions: string[];
  /** Positionally aligned with the recipe's `ingredients`. */
  ingredientNames: string[];
}

/** One language's name for a pantry item. */
export interface PantryTranslation {
  locale: Locale;
  name: string;
}
