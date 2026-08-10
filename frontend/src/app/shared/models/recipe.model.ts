/** A variation as offered to a reader: enough to choose between them. */
export interface RecipeVariationSummary {
  id: string;
  name: string;
  /** Why you would cook it this way. */
  note: string;
}

import { Difficulty } from '../enums/difficulty.enum';
import { PantryCategory } from '../enums/pantry-category.enum';
import { Unit } from '../enums/unit.enum';

export interface RecipeIngredient {
  /**
   * Which existing ingredient this row is. Absent on a new one.
   *
   * Sent on a save for the same reason `stepIds` is: variations point at
   * ingredient ids and that link cascades on delete, so a save that could not
   * say which row is which used to take every "10 g of yeast" with it.
   */
  id?: string;
  name: string;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  instructions: string[];
  instructionImages?: string[];
  ingredients: RecipeIngredient[];
  prepTime: number;
  cookTime: number;
  difficulty: Difficulty;
  tags: string[];
  imageUrl?: string;
  /** Gallery-sized WebP. Absent means fall back to imageUrl. */
  thumbnailUrl?: string;
  /** The method with its identities, for anything that needs to point at a step. */
  steps?: { id: string; text: string; imageUrl: string | null }[];
  /**
   * Which existing step each position in `instructions` is, on a save.
   *
   * Null adds one. Omitted when the client cannot answer honestly — the server
   * then refuses rather than guessing, if variations point at those steps.
   */
  stepIds?: (string | null)[];
  /** The other ways this recipe can be cooked. Absent means there are none. */
  variations?: RecipeVariationSummary[];
  /**
   * Which variation everything above has been resolved to.
   *
   * The server resolves it, so nothing here applies overrides itself — a page
   * and a shopping list cannot end up disagreeing about what it contains.
   */
  variationId?: string;
  /** Who added it, and the one person who can always read it back. */
  createdBy?: { id: string; displayName: string };
  /** True means only the author's kitchen sees it. Absent reads as false. */
  isPrivate?: boolean;
  /**
   * Likes and stars: everyone's, plus this reader's own.
   *
   * Sent with every recipe the API reads back, so a list of twelve cards costs
   * no extra requests. Optional only because a recipe being WRITTEN has none.
   */
  reactions?: RecipeReactionSummary;
}

/**
 * What people think of a recipe.
 *
 * A like and a score are independent. A like is a bookmark — "cook this again"
 * — and the stars are a verdict, so neither is derived from the other.
 */
export interface RecipeReactionSummary {
  likeCount: number;
  ratingCount: number;
  /**
   * The mean score, or null when nobody has rated it.
   *
   * Null and not 0: an unrated dish must not be displayed as one that everybody
   * scored zero.
   */
  ratingAverage: number | null;
  likedByMe: boolean;
  /** This reader's own score, or null. Always null for a guest. */
  myStars: number | null;
}

/** A recipe nobody has reacted to, and what a guest sees of their own. */
export const NO_REACTIONS: RecipeReactionSummary = {
  likeCount: 0,
  ratingCount: 0,
  ratingAverage: null,
  likedByMe: false,
  myStars: null,
};
