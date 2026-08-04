import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertCanModify } from './recipe-ownership.js';

const MARTIN = 'u-martin';
const HEIDI = 'u-heidi';

const recipe = (createdById?: string) => ({ id: 'r1', createdById });

describe('assertCanModify', () => {
  it('lets the creator through', () => {
    expect(() => assertCanModify(recipe(MARTIN), MARTIN)).not.toThrow();
  });

  it('REFUSES someone else, even though they are signed in', () => {
    // The whole point. Every signed-in user could previously edit or delete any
    // recipe in the shared library; hiding the buttons only hid the buttons.
    expect(() => assertCanModify(recipe(MARTIN), HEIDI)).toThrow(ForbiddenException);
  });

  it('names the constraint rather than saying "forbidden"', () => {
    // Someone hitting this is usually confused, not malicious.
    expect(() => assertCanModify(recipe(MARTIN), HEIDI)).toThrow(/who added this recipe/i);
  });

  it('refuses a recipe with no recorded author rather than letting anyone edit it', () => {
    // Should not be reachable — createdById is NOT NULL — but "no owner" must
    // never read as "everyone owns it".
    expect(() => assertCanModify(recipe(undefined), MARTIN)).toThrow(ForbiddenException);
  });

  it('refuses when the caller has no id', () => {
    expect(() => assertCanModify(recipe(MARTIN), '')).toThrow(ForbiddenException);
  });

  it('throws NotFound for a missing recipe, without revealing whose it was', () => {
    expect(() => assertCanModify(null, MARTIN)).toThrow(NotFoundException);
  });
});
