import type { TranslationKey } from '../../shared/i18n';

/**
 * How the recipe library is laid out.
 *
 * - `cards`   — the original: a grid of cards with description, meta and tags.
 * - `list`    — one row per recipe. Scannable when you know what you are after.
 * - `gallery` — image-led. The recipe photographs are the point.
 */
export type RecipeViewMode = 'cards' | 'list' | 'gallery';

export interface RecipeViewModeOption {
  readonly value: RecipeViewMode;
  readonly labelKey: TranslationKey;
}

export const RECIPE_VIEW_MODES: readonly RecipeViewModeOption[] = [
  { value: 'cards', labelKey: 'recipe.view.cards' },
  { value: 'list', labelKey: 'recipe.view.list' },
  { value: 'gallery', labelKey: 'recipe.view.gallery' },
];

/** The existing layout stays the default — this adds choice, it does not impose one. */
export const DEFAULT_RECIPE_VIEW_MODE: RecipeViewMode = 'cards';

export const RECIPE_VIEW_MODE_STORAGE_KEY = 'recipe-manager.recipeViewMode';

export function isRecipeViewMode(value: unknown): value is RecipeViewMode {
  return RECIPE_VIEW_MODES.some((m) => m.value === value);
}

/** localStorage throws in some privacy modes; no stored preference is not an error. */
export function readStoredViewMode(): RecipeViewMode {
  try {
    const stored = localStorage.getItem(RECIPE_VIEW_MODE_STORAGE_KEY);
    return isRecipeViewMode(stored) ? stored : DEFAULT_RECIPE_VIEW_MODE;
  } catch {
    return DEFAULT_RECIPE_VIEW_MODE;
  }
}

export function writeStoredViewMode(mode: RecipeViewMode): void {
  try {
    localStorage.setItem(RECIPE_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Preference simply will not survive the session.
  }
}
