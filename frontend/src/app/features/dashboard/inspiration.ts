import { Recipe } from '../../shared/models/recipe.model';
import { MatchResult } from './dashboard.service';

/**
 * A dish suggested on the dashboard, carrying how close the pantry is to it.
 *
 * `have`/`total` is the point of the whole feature: a suggestion you cannot act
 * on is decoration. `null` means genuinely unknown rather than zero — the match
 * API reports which ingredients are missing only for near-misses, so claiming
 * "0 of 12" for the rest would be inventing a number.
 */
export interface Inspiration {
  readonly recipe: Recipe;
  readonly have: number | null;
  readonly total: number;
}

export const INSPIRATION_COUNT = 3;

/**
 * Stable pseudo-random offset derived from the date.
 *
 * Re-rolling on every render makes the page feel broken — you glance away, look
 * back, and the suggestions have changed. Seeding by day means the trio is fixed
 * for the day and refreshes tomorrow.
 */
export function dailySeed(today: Date): number {
  return today.getFullYear() * 1000 + dayOfYear(today);
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((now - start) / 86_400_000);
}

/**
 * Choose the dishes to suggest.
 *
 * Ordered by how cookable they are — everything you can make tonight first, then
 * near-misses, then the rest — and rotated by the daily seed so the same few
 * recipes do not sit there forever. Ranking before rotating matters: rotating a
 * flat list would surface a recipe missing nine ingredients ahead of one you
 * could cook right now.
 */
export function pickInspiration(
  match: MatchResult,
  seed: number,
  count = INSPIRATION_COUNT,
): Inspiration[] {
  const ranked: Inspiration[] = [
    ...match.canMakeNow.map((recipe) => ({
      recipe,
      total: recipe.ingredients.length,
      have: recipe.ingredients.length,
    })),
    ...match.almostCanMake.map((entry) => ({
      recipe: entry.recipe,
      total: entry.recipe.ingredients.length,
      have: Math.max(0, entry.recipe.ingredients.length - entry.missingIngredients.length),
    })),
    ...match.missingMany.map((recipe) => ({
      recipe,
      total: recipe.ingredients.length,
      have: null,
    })),
  ];

  if (ranked.length === 0) {
    return [];
  }

  // Rotate within each tier rather than across the whole list, so the top tier
  // keeps its priority while still varying day to day.
  const offset = seed % ranked.length;
  const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)];

  const byCookability = [...rotated].sort((a, b) => tier(a) - tier(b));
  return byCookability.slice(0, count);
}

function tier(i: Inspiration): number {
  if (i.have === null) return 2;
  return i.have === i.total ? 0 : 1;
}
