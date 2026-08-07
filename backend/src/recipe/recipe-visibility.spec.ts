import {
  visibilityWhere,
  ANONYMOUS,
  UNRESTRICTED,
  type RecipeViewer,
  type RecipeAudience,
} from './recipe-visibility';

/**
 * These cases are the access-control policy itself, so they are written as the
 * questions someone would actually ask of it rather than as clause assertions:
 * the WHERE is an implementation detail, "can this person see it?" is not.
 *
 * `matches` evaluates the generated Prisma WHERE against a plain row, which
 * keeps the tests honest about behaviour without needing a database.
 */
interface Row {
  isPrivate: boolean;
  createdById: string;
  pantryId: string | null;
}

function matches(audience: RecipeAudience, row: Row): boolean {
  const where = visibilityWhere(audience);

  // Unrestricted: an empty WHERE, which constrains nothing.
  if (Object.keys(where).length === 0) {
    return true;
  }

  // Anonymous: a single `isPrivate: false` clause.
  if (!where.OR) {
    return row.isPrivate === false;
  }

  return where.OR.some((arm) => {
    if ('isPrivate' in arm && arm.isPrivate !== undefined) {
      return row.isPrivate === arm.isPrivate;
    }
    if ('createdById' in arm && typeof arm.createdById === 'string') {
      return row.createdById === arm.createdById;
    }
    if ('pantryId' in arm && arm.pantryId && typeof arm.pantryId === 'object') {
      const ids = (arm.pantryId as { in: string[] }).in;
      return row.pantryId !== null && ids.includes(row.pantryId);
    }
    return false;
  });
}

const PUBLIC: Row = {
  isPrivate: false,
  createdById: 'u-martin',
  pantryId: 'p-home',
};
const PRIVATE: Row = {
  isPrivate: true,
  createdById: 'u-martin',
  pantryId: 'p-home',
};

const AUTHOR: RecipeViewer = { userId: 'u-martin', pantryIds: ['p-home'] };
const HOUSEMATE: RecipeViewer = { userId: 'u-heidi', pantryIds: ['p-home'] };
const STRANGER: RecipeViewer = {
  userId: 'u-stranger',
  pantryIds: ['p-elsewhere'],
};

describe('recipe visibility', () => {
  describe('the shared library stays shared', () => {
    it('shows a public recipe to a guest who is not signed in', () => {
      // The distractor: a policy that hid everything would pass every negative
      // case below and still have broken the app for everyone.
      expect(matches(ANONYMOUS, PUBLIC)).toBe(true);
    });

    it('shows a public recipe to a signed-in stranger', () => {
      expect(matches(STRANGER, PUBLIC)).toBe(true);
    });
  });

  describe('a private recipe stays in its kitchen', () => {
    it('hides it from a guest', () => {
      expect(matches(ANONYMOUS, PRIVATE)).toBe(false);
    });

    it('hides it from someone in a different kitchen', () => {
      expect(matches(STRANGER, PRIVATE)).toBe(false);
    });

    it('shows it to another member of that kitchen', () => {
      // This is the whole point: private means "my household", not "just me".
      expect(matches(HOUSEMATE, PRIVATE)).toBe(true);
    });

    it('shows it to the author', () => {
      expect(matches(AUTHOR, PRIVATE)).toBe(true);
    });
  });

  describe('the author never loses their own recipe', () => {
    it('shows it after they have left the kitchen it was written in', () => {
      const left: RecipeViewer = { userId: 'u-martin', pantryIds: [] };
      expect(matches(left, PRIVATE)).toBe(true);
    });

    it('shows it when the kitchen was deleted out from under it', () => {
      // pantryId is SET NULL on kitchen delete. The recipe must fall back to
      // author-only — falling back to public would leak it to everyone.
      const orphaned: Row = { ...PRIVATE, pantryId: null };
      expect(matches(AUTHOR, orphaned)).toBe(true);
      expect(matches(HOUSEMATE, orphaned)).toBe(false);
      expect(matches(ANONYMOUS, orphaned)).toBe(false);
    });
  });

  describe('a viewer with no kitchen', () => {
    it('still sees the shared library', () => {
      const kitchenless: RecipeViewer = { userId: 'u-new', pantryIds: [] };
      expect(matches(kitchenless, PUBLIC)).toBe(true);
    });

    it('sees no private recipe but their own', () => {
      const kitchenless: RecipeViewer = { userId: 'u-new', pantryIds: [] };
      expect(matches(kitchenless, PRIVATE)).toBe(false);
    });

    it('does not emit an empty `in` clause', () => {
      // `pantryId: { in: [] }` matches nothing, so it is only noise in the SQL.
      const where = visibilityWhere({ userId: 'u-new', pantryIds: [] });
      expect(JSON.stringify(where)).not.toContain('"in":[]');
    });
  });

  describe('the clause an anonymous read produces', () => {
    it('is a plain isPrivate check with no OR to combine', () => {
      // findAll already owns the top-level OR for its text search, so keeping
      // the anonymous case narrow is what lets the two be AND-ed safely.
      expect(visibilityWhere(ANONYMOUS)).toEqual({ isPrivate: false });
    });
  });

  describe('an unrestricted read', () => {
    // Used where authorisation already happened one level up — resolving the
    // recipe behind a meal-plan entry in the reader's own kitchen. Filtering
    // there would break a private recipe the reader put in their own plan.
    it('constrains nothing', () => {
      expect(visibilityWhere(UNRESTRICTED)).toEqual({});
      expect(matches(UNRESTRICTED, PRIVATE)).toBe(true);
      expect(matches(UNRESTRICTED, PUBLIC)).toBe(true);
    });
  });
});
