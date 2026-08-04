import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PantryAccessService } from './pantry-access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

const martin: LocalUser = {
  id: 'u-martin', ssoSubject: 's-martin', email: 'mhylle@yahoo.com', displayName: 'Martin Hylleberg',
};
const heidi: LocalUser = {
  id: 'u-heidi', ssoSubject: 's-heidi', email: 'heidi@example.com', displayName: 'Heidi Klitgaard',
};

type Membership = { pantryId: string; userId: string; role: string; joinedAt: Date };

function fakePrisma(memberships: Membership[]) {
  return {
    pantryMember: {
      findUnique: jest.fn(({ where }: { where: { pantryId_userId: { pantryId: string; userId: string } } }) =>
        Promise.resolve(
          memberships.find(
            (m) =>
              m.pantryId === where.pantryId_userId.pantryId &&
              m.userId === where.pantryId_userId.userId,
          ) ?? null,
        ),
      ),
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        // Honour the orderBy the service asks for. A fake that returns insertion
        // order lets a test assert whatever the fixture happens to list first,
        // and real Prisma then does something else.
        Promise.resolve(
          memberships
            .filter((m) => m.userId === where.userId)
            .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()),
        ),
      ),
    },
  };
}

const make = (memberships: Membership[]) =>
  new PantryAccessService(fakePrisma(memberships) as unknown as PrismaService);

const D = (iso: string) => new Date(iso);

describe('PantryAccessService.resolve', () => {
  describe('with an explicit pantry id', () => {
    it('allows a member', async () => {
      const svc = make([{ pantryId: 'p-home', userId: martin.id, role: 'owner', joinedAt: D('2026-01-01') }]);
      await expect(svc.resolve(martin, 'p-home')).resolves.toBe('p-home');
    });

    it('REFUSES a non-member with 403, not an empty result', async () => {
      // The whole point of this service. Returning an empty list instead would
      // look like a working feature while the check was missing — which is how
      // this class of hole survives review.
      const svc = make([{ pantryId: 'p-home', userId: martin.id, role: 'owner', joinedAt: D('2026-01-01') }]);
      await expect(svc.resolve(heidi, 'p-home')).rejects.toThrow(ForbiddenException);
    });

    it('refuses a pantry that does not exist, rather than falling back to the default', async () => {
      // Falling back would let a typo silently write into the wrong kitchen.
      const svc = make([{ pantryId: 'p-home', userId: martin.id, role: 'owner', joinedAt: D('2026-01-01') }]);
      await expect(svc.resolve(martin, 'p-nonexistent')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('with no pantry id', () => {
    it('uses the one the caller owns', async () => {
      const svc = make([
        { pantryId: 'p-shared', userId: martin.id, role: 'member', joinedAt: D('2026-01-01') },
        { pantryId: 'p-own', userId: martin.id, role: 'owner', joinedAt: D('2026-06-01') },
      ]);
      // Owned wins even though the shared one was joined first — otherwise the
      // default depends on the order someone happened to be invited.
      await expect(svc.resolve(martin)).resolves.toBe('p-own');
    });

    it('falls back to the earliest joined when the caller owns none', async () => {
      // Listed newest-first on purpose: the answer must come from joinedAt, not
      // from the order the rows happen to arrive in.
      const svc = make([
        { pantryId: 'p-second', userId: heidi.id, role: 'member', joinedAt: D('2026-06-01') },
        { pantryId: 'p-first', userId: heidi.id, role: 'member', joinedAt: D('2026-01-01') },
      ]);
      await expect(svc.resolve(heidi)).resolves.toBe('p-first');
    });

    it('tells a user with no pantry what to do instead of failing obscurely', async () => {
      const svc = make([]);
      await expect(svc.resolve(heidi)).rejects.toThrow(NotFoundException);
    });
  });

  describe('isolation between households', () => {
    it('never leaks another household even when both users are known', async () => {
      const svc = make([
        { pantryId: 'p-martin', userId: martin.id, role: 'owner', joinedAt: D('2026-01-01') },
        { pantryId: 'p-heidi', userId: heidi.id, role: 'owner', joinedAt: D('2026-01-01') },
      ]);
      await expect(svc.resolve(martin)).resolves.toBe('p-martin');
      await expect(svc.resolve(heidi)).resolves.toBe('p-heidi');
      await expect(svc.resolve(martin, 'p-heidi')).rejects.toThrow(ForbiddenException);
      await expect(svc.resolve(heidi, 'p-martin')).rejects.toThrow(ForbiddenException);
    });
  });
});
