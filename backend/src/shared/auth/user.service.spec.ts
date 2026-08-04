import { UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/** Minimal in-memory stand-in for the `user` delegate, with a real unique index. */
function fakePrisma() {
  const rows = new Map<string, { id: string; ssoSubject: string; email: string; displayName: string }>();
  let seq = 0;

  const api = {
    rows,
    upsertCalls: 0,
    /** Set to make the next upsert lose a race, the way a real unique index would. */
    failNextUpsertWithP2002: false,
    user: {
      findUnique: jest.fn(({ where }: { where: { ssoSubject?: string } }) =>
        Promise.resolve(
          where.ssoSubject ? (rows.get(where.ssoSubject) ?? null) : null,
        ),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { ssoSubject: string };
          create: { ssoSubject: string; email: string; displayName: string };
          update: { email: string; displayName: string };
        }) => {
          api.upsertCalls++;
          if (api.failNextUpsertWithP2002) {
            api.failNextUpsertWithP2002 = false;
            // What Prisma throws when two concurrent upserts both miss the read
            // and both try to insert.
            return Promise.reject(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
          }
          const existing = rows.get(where.ssoSubject);
          if (existing) {
            Object.assign(existing, update);
            return Promise.resolve(existing);
          }
          const created = { id: `user-${++seq}`, ...create };
          rows.set(create.ssoSubject, created);
          return Promise.resolve(created);
        },
      ),
    },
  };
  return api;
}

const SUBJECT = '97f9ac37-13ef-4bef-964a-5da09d776497';

describe('UserService', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let service: UserService;
  const savedServiceUser = process.env.RECIPE_MANAGER_SERVICE_USER;

  beforeEach(() => {
    prisma = fakePrisma();
    service = new UserService(prisma as unknown as PrismaService);
  });

  afterAll(() => {
    if (savedServiceUser === undefined) delete process.env.RECIPE_MANAGER_SERVICE_USER;
    else process.env.RECIPE_MANAGER_SERVICE_USER = savedServiceUser;
  });

  describe('provisioning from SSO claims', () => {
    it('creates exactly one row the first time a subject is seen', async () => {
      const user = await service.resolveFromClaims({
        sub: SUBJECT,
        email: 'mhylle@yahoo.com',
        firstName: 'Martin',
        lastName: 'Hylleberg',
      });

      expect(user.ssoSubject).toBe(SUBJECT);
      expect(user.displayName).toBe('Martin Hylleberg');
      expect(prisma.rows.size).toBe(1);
    });

    it('does not create a second row on the next request', async () => {
      const claims = { sub: SUBJECT, email: 'mhylle@yahoo.com', firstName: 'Martin', lastName: 'Hylleberg' };
      const first = await service.resolveFromClaims(claims);
      const second = await service.resolveFromClaims(claims);

      expect(second.id).toBe(first.id);
      expect(prisma.rows.size).toBe(1);
    });

    it('refreshes the cached email when the SAME subject changes address', async () => {
      // The whole reason the join key is `sub` and not `email`. Keying on email
      // would strand this user's pantry behind their old address.
      const first = await service.resolveFromClaims({
        sub: SUBJECT, email: 'old@example.com', firstName: 'Martin', lastName: 'Hylleberg',
      });
      const second = await service.resolveFromClaims({
        sub: SUBJECT, email: 'new@example.com', firstName: 'Martin', lastName: 'Hylleberg',
      });

      expect(second.id).toBe(first.id);
      expect(second.email).toBe('new@example.com');
      expect(prisma.rows.size).toBe(1);
    });

    it('keeps two subjects separate even if they share an email', async () => {
      // auth_db has a unique index on email, but nothing here should depend on
      // that: two subjects are two people, whatever address they present.
      await service.resolveFromClaims({ sub: 'subject-a', email: 'shared@example.com' });
      await service.resolveFromClaims({ sub: 'subject-b', email: 'shared@example.com' });

      expect(prisma.rows.size).toBe(2);
    });

    it('survives losing the insert race, rather than 500ing on the first login', async () => {
      // Two tabs, one cold start: both miss the read and both insert. One wins.
      // The loser must return the winner's row, not a unique-violation error.
      prisma.rows.set(SUBJECT, {
        id: 'winner', ssoSubject: SUBJECT, email: 'mhylle@yahoo.com', displayName: 'Martin Hylleberg',
      });
      prisma.failNextUpsertWithP2002 = true;

      const user = await service.resolveFromClaims({ sub: SUBJECT, email: 'mhylle@yahoo.com' });
      expect(user.id).toBe('winner');
    });

    it('rethrows a non-P2002 database failure instead of swallowing it', async () => {
      prisma.user.upsert.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'P1001' }));
      await expect(service.resolveFromClaims({ sub: SUBJECT, email: 'x@y.z' })).rejects.toThrow('boom');
    });
  });

  describe('display name', () => {
    it('prefers an explicit name claim', async () => {
      const u = await service.resolveFromClaims({
        sub: 's1', email: 'a@b.c', name: 'Preferred Name', firstName: 'Ignored', lastName: 'Ignored',
      });
      expect(u.displayName).toBe('Preferred Name');
    });

    it('composes first and last when there is no name claim', async () => {
      const u = await service.resolveFromClaims({ sub: 's2', email: 'a@b.c', firstName: 'Heidi', lastName: 'Klitgaard' });
      expect(u.displayName).toBe('Heidi Klitgaard');
    });

    it('falls back to the email rather than showing a blank byline', async () => {
      const u = await service.resolveFromClaims({ sub: 's3', email: 'nameless@example.com' });
      expect(u.displayName).toBe('nameless@example.com');
    });

    it('does not leave a stray space when only one part is present', async () => {
      const u = await service.resolveFromClaims({ sub: 's4', email: 'a@b.c', firstName: 'Cassandra' });
      expect(u.displayName).toBe('Cassandra');
    });
  });

  describe('the machine caller', () => {
    it('resolves the configured service user', async () => {
      prisma.rows.set(SUBJECT, {
        id: 'martin', ssoSubject: SUBJECT, email: 'mhylle@yahoo.com', displayName: 'Martin Hylleberg',
      });
      process.env.RECIPE_MANAGER_SERVICE_USER = SUBJECT;

      await expect(service.resolveServiceUser()).resolves.toEqual(
        expect.objectContaining({ id: 'martin' }),
      );
    });

    it('refuses when no service user is configured — never writes unattributed', async () => {
      // A row with no owner is a row nothing can later reach.
      delete process.env.RECIPE_MANAGER_SERVICE_USER;
      await expect(service.resolveServiceUser()).rejects.toThrow(UnauthorizedException);
    });

    it('refuses when the configured subject has no local row, rather than inventing one', async () => {
      // Catches a typo'd subject at the first request instead of silently
      // creating a ghost user that owns production writes.
      process.env.RECIPE_MANAGER_SERVICE_USER = 'not-a-real-subject';
      await expect(service.resolveServiceUser()).rejects.toThrow(UnauthorizedException);
    });
  });
});
