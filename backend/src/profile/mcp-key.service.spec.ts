import { NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { McpKeyService } from './mcp-key.service';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  userId: string;
  tokenHash: string;
  prefix: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

function createPrismaStub(
  users: Record<string, boolean> = { 'u-1': true, 'u-2': false },
) {
  const rows: Row[] = [];
  let next = 1;

  return {
    rows: () => rows,
    mcpApiKey: {
      create: jest.fn(
        ({
          data,
        }: {
          data: {
            userId: string;
            label: string;
            tokenHash: string;
            prefix: string;
          };
        }) => {
          const row: Row = {
            id: `key-${next++}`,
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
            ...data,
          };
          rows.push(row);
          return Promise.resolve(row);
        },
      ),
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(rows.filter((r) => r.userId === where.userId)),
      ),
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) => {
        const row = rows.find((r) => r.tokenHash === where.tokenHash);
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          ...row,
          user: { canContribute: users[row.userId] ?? false },
        });
      }),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; userId: string; revokedAt: null };
          data: { revokedAt: Date };
        }) => {
          const row = rows.find(
            (r) =>
              r.id === where.id &&
              r.userId === where.userId &&
              r.revokedAt === null,
          );
          if (!row) return Promise.resolve({ count: 0 });
          row.revokedAt = data.revokedAt;
          return Promise.resolve({ count: 1 });
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { lastUsedAt: Date };
        }) => {
          const row = rows.find((r) => r.id === where.id);
          if (row) row.lastUsedAt = data.lastUsedAt;
          return Promise.resolve(row);
        },
      ),
    },
  };
}

describe('McpKeyService', () => {
  let service: McpKeyService;
  let prisma: ReturnType<typeof createPrismaStub>;

  beforeEach(() => {
    prisma = createPrismaStub();
    service = new McpKeyService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('returns a token exactly once', async () => {
      const created = await service.create('u-1', 'work laptop');

      expect(created.token).toMatch(/^rmk_[A-Za-z0-9_-]{20,}$/);
      // And it is nowhere in the list afterwards.
      const listed = await service.list('u-1');
      expect(JSON.stringify(listed)).not.toContain(created.token);
    });

    it('stores only a hash, never the token', async () => {
      // A table that can hand back live credentials makes every backup of it a
      // set of live credentials.
      const created = await service.create('u-1', 'work laptop');
      const row = prisma.rows()[0];

      expect(row.tokenHash).toBe(
        createHash('sha256').update(created.token).digest('hex'),
      );
      expect(row.tokenHash).not.toContain(created.token);
      expect(JSON.stringify(row)).not.toContain(created.token);
    });

    it('keeps a prefix so two keys can be told apart', async () => {
      const created = await service.create('u-1', 'laptop');
      expect(created.prefix.startsWith('rmk_')).toBe(true);
      expect(created.token.startsWith(created.prefix)).toBe(true);
      // Short enough not to be the secret itself.
      expect(created.prefix.length).toBeLessThan(created.token.length / 2);
    });

    it('gives every key a different token', async () => {
      const a = await service.create('u-1', 'one');
      const b = await service.create('u-1', 'two');
      expect(a.token).not.toBe(b.token);
    });
  });

  describe('resolve', () => {
    it('finds the owner of a valid key', async () => {
      const created = await service.create('u-1', 'laptop');
      expect(await service.resolve(created.token)).toEqual({
        userId: 'u-1',
        canContribute: true,
      });
    });

    it('carries the owner’s cached grant, so the gate applies per person', async () => {
      // u-2 has no contribution grant; their key must not gain one.
      const created = await service.create('u-2', 'laptop');
      expect(await service.resolve(created.token)).toEqual({
        userId: 'u-2',
        canContribute: false,
      });
    });

    it('refuses a revoked key', async () => {
      const created = await service.create('u-1', 'laptop');
      await service.revoke('u-1', created.id);

      expect(await service.resolve(created.token)).toBeNull();
    });

    it('refuses an unknown key', async () => {
      expect(await service.resolve('rmk_never-issued-at-all')).toBeNull();
    });

    it('refuses anything without the prefix, without touching the database', async () => {
      expect(await service.resolve('some-other-credential')).toBeNull();
      expect(prisma.mcpApiKey.findUnique).not.toHaveBeenCalled();
    });

    it('records last use, so a forgotten key is recognisable', async () => {
      const created = await service.create('u-1', 'laptop');
      expect(prisma.rows()[0].lastUsedAt).toBeNull();

      await service.resolve(created.token);
      await new Promise((r) => setImmediate(r));

      expect(prisma.rows()[0].lastUsedAt).not.toBeNull();
    });
  });

  describe('revoke', () => {
    it('marks the key revoked rather than deleting it', async () => {
      // A key that vanishes looks like one that never existed, which is a
      // confusing thing to see right after revoking it.
      const created = await service.create('u-1', 'laptop');
      await service.revoke('u-1', created.id);

      const listed = await service.list('u-1');
      expect(listed).toHaveLength(1);
      expect(listed[0].revokedAt).not.toBeNull();
    });

    it('refuses to revoke another user’s key', async () => {
      const created = await service.create('u-1', 'laptop');
      await expect(service.revoke('u-2', created.id)).rejects.toThrow(
        NotFoundException,
      );
      // Still usable by its owner.
      expect(await service.resolve(created.token)).not.toBeNull();
    });

    it('refuses to revoke twice', async () => {
      const created = await service.create('u-1', 'laptop');
      await service.revoke('u-1', created.id);
      await expect(service.revoke('u-1', created.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('shows only this user’s keys', async () => {
      await service.create('u-1', 'mine');
      await service.create('u-2', 'theirs');

      const listed = await service.list('u-1');
      expect(listed).toHaveLength(1);
      expect(listed[0].label).toBe('mine');
    });
  });
});
