import type { Prisma } from '@prisma/client';

/**
 * Who is asking. `null` is a guest — the recipe list is open to people who have
 * not signed in, and that stays true.
 */
export interface RecipeViewer {
  userId: string;
  /** Every kitchen they belong to, not just the one they have selected. */
  pantryIds: string[];
}

/** Nobody is signed in. The shared library, and nothing else. */
export const ANONYMOUS = 'anonymous';

/**
 * No visibility filter at all.
 *
 * For reads that resolve a recipe already referenced by a row the caller was
 * authorised for — the meal-plan entry a shopping list is built from, say.
 * Filtering there would break a private recipe in the reader's own meal plan,
 * and the authorisation has already happened one level up.
 *
 * Never reachable from an HTTP read of the recipe collection itself.
 */
export const UNRESTRICTED = 'unrestricted';

/**
 * Who a recipe read is being performed for.
 *
 * A union rather than an optional parameter on purpose. "Anonymous" and
 * "trusted internal caller" are opposite ends of this policy, and a defaulted
 * argument makes them the same forgettable omission — one that fails quietly,
 * by returning a short list rather than an error.
 */
export type RecipeAudience =
  | RecipeViewer
  | typeof ANONYMOUS
  | typeof UNRESTRICTED;

/**
 * Who to attribute "my like" and "my rating" to, if anyone.
 *
 * Separate from `visibilityWhere` because the two questions differ: an
 * UNRESTRICTED read is a trusted internal caller with no person behind it, so
 * it sees every recipe and yet has no reactions of its own.
 */
export function viewerIdOf(audience: RecipeAudience): string | undefined {
  return typeof audience === 'object' ? audience.userId : undefined;
}

/**
 * The WHERE that decides which recipes a caller may read.
 *
 * Expressed as data rather than as a post-filter on purpose: the list is paged
 * in SQL, so a row hidden after the query would leave a page short and make
 * `total` a lie about the caller's own library.
 *
 * Callers must combine this with their other filters under `AND` — `findAll`
 * already spends the top-level `OR` on its locale-aware text search, and a
 * second assignment would silently replace the first.
 */
export function visibilityWhere(
  audience: RecipeAudience,
): Prisma.RecipeWhereInput {
  if (audience === UNRESTRICTED) {
    return {};
  }
  if (audience === ANONYMOUS) {
    return { isPrivate: false };
  }
  const viewer = audience;

  const arms: Prisma.RecipeWhereInput[] = [
    { isPrivate: false },
    // The author keeps their own recipe whatever happens to the kitchen it was
    // pinned to — they may have left it, or it may have been deleted and set
    // this row's pantryId to null.
    { createdById: viewer.userId },
  ];

  // `in: []` matches nothing, so an arm for a viewer with no kitchen would only
  // add noise to the query.
  if (viewer.pantryIds.length > 0) {
    arms.push({ pantryId: { in: viewer.pantryIds } });
  }

  return { OR: arms };
}
