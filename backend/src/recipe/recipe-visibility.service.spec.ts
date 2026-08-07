import { RecipeVisibilityService } from './recipe-visibility.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Turns "who is asking" into the kitchens that answer decides by. The service
 * is thin, so these tests are about the two things that are easy to get wrong:
 * not querying at all for a guest, and not leaking another person's rows.
 */
function createPrismaStub(rows: { pantryId: string; userId: string }[]) {
  return {
    pantryMember: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          rows
            .filter((r) => r.userId === where.userId)
            .map((r) => ({ pantryId: r.pantryId })),
        ),
      ),
    },
  };
}

describe('RecipeVisibilityService', () => {
  it('returns null for an anonymous caller', async () => {
    const prisma = createPrismaStub([]);
    const service = new RecipeVisibilityService(
      prisma as unknown as PrismaService,
    );

    expect(await service.forUser(undefined)).toBeNull();
  });

  it('does not query the database at all for a guest', async () => {
    // Every recipe list a guest loads would otherwise pay for a membership
    // lookup that can only ever come back empty.
    const prisma = createPrismaStub([]);
    const service = new RecipeVisibilityService(
      prisma as unknown as PrismaService,
    );

    await service.forUser(undefined);

    expect(prisma.pantryMember.findMany).not.toHaveBeenCalled();
  });

  it('collects every kitchen the caller belongs to', async () => {
    // Not just their selected one: a recipe private to the summerhouse must
    // still be readable while the home kitchen is on screen.
    const prisma = createPrismaStub([
      { pantryId: 'p-home', userId: 'u-martin' },
      { pantryId: 'p-summerhouse', userId: 'u-martin' },
      { pantryId: 'p-elsewhere', userId: 'u-stranger' },
    ]);
    const service = new RecipeVisibilityService(
      prisma as unknown as PrismaService,
    );

    expect(await service.forUser('u-martin')).toEqual({
      userId: 'u-martin',
      pantryIds: ['p-home', 'p-summerhouse'],
    });
  });

  it('gives a caller with no kitchen an empty list, not null', async () => {
    // null means "guest" and would drop their own private recipes. Someone who
    // has signed in but not made a kitchen yet is not a guest.
    const prisma = createPrismaStub([]);
    const service = new RecipeVisibilityService(
      prisma as unknown as PrismaService,
    );

    expect(await service.forUser('u-new')).toEqual({
      userId: 'u-new',
      pantryIds: [],
    });
  });
});
