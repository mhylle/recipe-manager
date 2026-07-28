import { describe, it, expect } from 'vitest';
import { pickInspiration, dailySeed, INSPIRATION_COUNT } from './inspiration';
import { MatchResult } from './dashboard.service';
import { Recipe } from '../../shared/models/recipe.model';
import { Difficulty } from '../../shared/enums/difficulty.enum';
import { Unit } from '../../shared/enums/unit.enum';
import { PantryCategory } from '../../shared/enums/pantry-category.enum';

function recipe(name: string, ingredientCount: number): Recipe {
  return {
    id: name,
    name,
    description: '',
    servings: 2,
    instructions: [],
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      name: `ing-${i}`,
      quantity: 1,
      unit: Unit.G,
      pantryCategory: PantryCategory.OTHER,
    })),
    prepTime: 5,
    cookTime: 5,
    difficulty: Difficulty.EASY,
    tags: [],
  };
}

const empty: MatchResult = { canMakeNow: [], almostCanMake: [], missingMany: [] };

describe('pickInspiration', () => {
  it('returns nothing when there are no recipes at all', () => {
    expect(pickInspiration(empty, 1)).toEqual([]);
  });

  it('returns at most three', () => {
    const match: MatchResult = {
      ...empty,
      canMakeNow: Array.from({ length: 10 }, (_, i) => recipe(`r${i}`, 4)),
    };
    expect(pickInspiration(match, 1)).toHaveLength(INSPIRATION_COUNT);
  });

  it('reports full readiness for something you can cook now', () => {
    const match: MatchResult = { ...empty, canMakeNow: [recipe('Ready', 6)] };
    const [pick] = pickInspiration(match, 0);
    expect(pick.have).toBe(6);
    expect(pick.total).toBe(6);
  });

  it('subtracts the missing ingredients for a near-miss', () => {
    const match: MatchResult = {
      ...empty,
      almostCanMake: [
        {
          recipe: recipe('Almost', 10),
          missingIngredients: [
            { name: 'a', required: 1, available: 0, unit: 'g' },
            { name: 'b', required: 1, available: 0, unit: 'g' },
          ],
        },
      ],
    };
    const [pick] = pickInspiration(match, 0);
    expect(pick.have).toBe(8);
    expect(pick.total).toBe(10);
  });

  it('reports UNKNOWN rather than zero when the API gives no missing list', () => {
    // Distractor: defaulting to 0 would render a confident "0 of 12 ingredients"
    // that the data does not actually support.
    const match: MatchResult = { ...empty, missingMany: [recipe('Unknown', 12)] };
    const [pick] = pickInspiration(match, 0);
    expect(pick.have).toBeNull();
    expect(pick.total).toBe(12);
  });

  it('prefers what you can cook now over what needs a shop', () => {
    const match: MatchResult = {
      canMakeNow: [recipe('Cookable', 3)],
      almostCanMake: [
        { recipe: recipe('NearMiss', 5), missingIngredients: [{ name: 'x', required: 1, available: 0, unit: 'g' }] },
      ],
      missingMany: [recipe('Distant', 9)],
    };
    expect(pickInspiration(match, 0).map((p) => p.recipe.name)).toEqual([
      'Cookable',
      'NearMiss',
      'Distant',
    ]);
  });

  it('keeps cookable dishes on top whatever the seed', () => {
    // Rotating a flat list would let a nine-ingredients-missing recipe outrank
    // one you could cook right now, purely because of today's date.
    const match: MatchResult = {
      canMakeNow: [recipe('Cookable', 3)],
      almostCanMake: [],
      missingMany: Array.from({ length: 8 }, (_, i) => recipe(`Distant${i}`, 9)),
    };
    for (const seed of [0, 1, 2, 3, 5, 8, 13, 21, 100, 365]) {
      expect(pickInspiration(match, seed)[0].recipe.name).toBe('Cookable');
    }
  });

  it('is stable within a day and differs across days', () => {
    const match: MatchResult = {
      ...empty,
      canMakeNow: Array.from({ length: 12 }, (_, i) => recipe(`r${i}`, 4)),
    };
    const monday = dailySeed(new Date(2026, 6, 27));
    const tuesday = dailySeed(new Date(2026, 6, 28));

    const a = pickInspiration(match, monday).map((p) => p.recipe.name);
    const b = pickInspiration(match, monday).map((p) => p.recipe.name);
    const c = pickInspiration(match, tuesday).map((p) => p.recipe.name);

    expect(a).toEqual(b); // same day -> identical
    expect(a).not.toEqual(c); // next day -> moved on
  });
});
