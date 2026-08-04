import { StaplesService } from './staples.service';
import { PrismaService } from '../prisma/prisma.service';

// Staples were a single global row keyed "default" until pantries existed. The
// stub is keyed by pantryId now, because a stub that still held one row would
// make "keeps two kitchens apart" pass or fail for reasons unrelated to the
// service.

function createPrismaStub() {
  const rows = new Map<string, { id: string; pantryId: string; items: string[] }>();
  let lastTouched: string | null = null;
  return {
    row: () => (lastTouched ? (rows.get(lastTouched) ?? null) : null),
    staplesConfig: {
      findUnique: jest.fn(async ({ where }: { where: { pantryId: string } }) =>
        rows.get(where.pantryId) ?? null,
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { pantryId: string };
          create: { pantryId: string; items: string[] };
          update: { items: string[] };
        }) => {
          const existing = rows.get(where.pantryId);
          const next = existing
            ? { ...existing, items: update.items }
            : { id: `staples-${where.pantryId}`, ...create };
          rows.set(where.pantryId, next);
          lastTouched = where.pantryId;
          return next;
        },
      ),
    },
  };
}

describe('StaplesService', () => {
  let service: StaplesService;
  let prisma: ReturnType<typeof createPrismaStub>;

  beforeEach(() => {
    prisma = createPrismaStub();
    service = new StaplesService(prisma as unknown as PrismaService);
  });

  describe('getStaples', () => {
    it('should return default empty list when no config exists', async () => {
      expect(await service.getStaples('p-test')).toEqual({ items: [] });
    });

    it('should return saved staples', async () => {
      await service.updateStaples('p-test', { items: ['salt', 'pepper'] });
      expect(await service.getStaples('p-test')).toEqual({ items: ['salt', 'pepper'] });
    });
  });

  describe('updateStaples', () => {
    it('should save and return the staples list', async () => {
      const config = { items: ['salt', 'pepper', 'olive oil'] };
      expect(await service.updateStaples('p-test', config)).toEqual(config);
      expect(await service.getStaples('p-test')).toEqual(config);
    });

    it('keeps ONE row per pantry rather than creating many', async () => {
      await service.updateStaples('p-test', { items: ['salt'] });
      await service.updateStaples('p-test', { items: ['pepper'] });

      expect(prisma.staplesConfig.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.row()?.pantryId).toBe('p-test');
      expect(await service.getStaples('p-test')).toEqual({ items: ['pepper'] });
    });

    it('keeps two kitchens apart', async () => {
      // Was a single global row keyed "default", so this could not have held.
      await service.updateStaples('p-home', { items: ['salt'] });
      await service.updateStaples('p-summerhouse', { items: ['sugar'] });

      expect(await service.getStaples('p-home')).toEqual({ items: ['salt'] });
      expect(await service.getStaples('p-summerhouse')).toEqual({ items: ['sugar'] });
    });
  });

  describe('isStaple', () => {
    it('should return true for a staple item (case-insensitive)', async () => {
      await service.updateStaples('p-test', { items: ['Salt', 'Pepper'] });

      expect(await service.isStaple('p-test', 'salt')).toBe(true);
      expect(await service.isStaple('p-test', 'SALT')).toBe(true);
      expect(await service.isStaple('p-test', 'Salt')).toBe(true);
    });

    it('should return false for a non-staple item', async () => {
      await service.updateStaples('p-test', { items: ['Salt'] });
      expect(await service.isStaple('p-test', 'Flour')).toBe(false);
    });

    it('should return false when no staples configured', async () => {
      expect(await service.isStaple('p-test', 'Salt')).toBe(false);
    });
  });
});
