/**
 * What a cook thinks of a recipe, and what everyone thinks of it together.
 *
 * A like and a score are independent: a like is a bookmark ("cook this again"),
 * a score is a verdict. Neither implies the other, so both travel side by side
 * rather than one being derived from the other.
 */
export interface RecipeReactionSummary {
  /** How many people liked it. Public. */
  likeCount: number;
  /** How many people scored it. Public, and the divisor behind `ratingAverage`. */
  ratingCount: number;
  /**
   * The mean score, or null when nobody has rated it.
   *
   * Null rather than 0 because "unrated" and "rated zero" are different claims
   * about a recipe, and rendering the second when you mean the first tells
   * every reader the dish is bad.
   */
  ratingAverage: number | null;
  /** Whether the person asking liked it. False for a guest. */
  likedByMe: boolean;
  /** The score the person asking gave, or null. Never set for a guest. */
  myStars: number | null;
}

/** A recipe nobody has reacted to yet, and what a guest sees of their own. */
export const NO_REACTIONS: RecipeReactionSummary = {
  likeCount: 0,
  ratingCount: 0,
  ratingAverage: null,
  likedByMe: false,
  myStars: null,
};

/** The stored columns this module needs. Deliberately not the whole row. */
export interface ReactionRow {
  recipeId: string;
  userId: string;
  liked: boolean;
  stars: number | null;
}

export const MIN_STARS = 1;
export const MAX_STARS = 5;

/**
 * Fold the raw rows into one summary per recipe.
 *
 * Pure, and separate from the query, because the interesting part is the
 * arithmetic: which rows count towards which number. Only rows WITH a score
 * feed the average — an unrated like must not be counted as a zero, or liking
 * a recipe would lower its rating.
 */
export function summariseReactions(
  rows: readonly ReactionRow[],
  viewerId?: string,
): Map<string, RecipeReactionSummary> {
  const byRecipe = new Map<string, RecipeReactionSummary>();
  const starTotals = new Map<string, number>();

  for (const row of rows) {
    const summary = byRecipe.get(row.recipeId) ?? { ...NO_REACTIONS };

    if (row.liked) {
      summary.likeCount += 1;
    }
    if (row.stars !== null) {
      summary.ratingCount += 1;
      starTotals.set(
        row.recipeId,
        (starTotals.get(row.recipeId) ?? 0) + row.stars,
      );
    }
    // A guest has no id, and `undefined === undefined` would otherwise make
    // every anonymous reader look like the author of every reaction.
    if (viewerId !== undefined && row.userId === viewerId) {
      summary.likedByMe = row.liked;
      summary.myStars = row.stars;
    }

    byRecipe.set(row.recipeId, summary);
  }

  for (const [recipeId, summary] of byRecipe) {
    if (summary.ratingCount > 0) {
      // One decimal: the average is read as "4.2", and full float precision
      // would render as 4.333333333333333 in every client that forgets to
      // round. Rounding here makes the API the single place that decides.
      const mean = (starTotals.get(recipeId) ?? 0) / summary.ratingCount;
      summary.ratingAverage = Math.round(mean * 10) / 10;
    }
  }

  return byRecipe;
}

/**
 * Read a requested score as what to store.
 *
 * 0 is accepted and means "clear my rating" — the scale the request talks about
 * is 0-5, and the only way to take a score back would otherwise be to delete
 * the reaction, which would throw away the like sitting in the same row.
 *
 * Returns null for "store no score". Throws for anything off the scale, which
 * is a client bug rather than a user's choice.
 */
export function normaliseStars(stars: number): number | null {
  if (!Number.isInteger(stars)) {
    throw new RangeError(`stars must be a whole number, got ${stars}`);
  }
  if (stars === 0) {
    return null;
  }
  if (stars < MIN_STARS || stars > MAX_STARS) {
    throw new RangeError(
      `stars must be between 0 and ${MAX_STARS}, got ${stars}`,
    );
  }
  return stars;
}
