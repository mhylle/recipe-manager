import { StaplesService } from './staples.service';
import { PrismaService } from '../prisma/prisma.service';

// This spec previously drove a filesystem-backed StaplesService that read and wrote
// data/config/staples.json. The service has since moved to Prisma, so the old spec
// could not even compile. Rewritten against the current implementation with an
// in-memory stand-in for the single `default` StaplesConfig row — the assertions
// below are the same behaviours the original covered.

function createPrismaStub() {
  let row: { id: string; items: string[] } | null = null;
  return {
    row: () => row,
    staplesConfig: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(
        async ({ create, update }: { create: { id: string; items: string[] }; update: { items: string[] } }) => {
          row = row ? { ...row, items: update.items } : { ...create };
          return row;
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
      expect(await service.getStaples()).toEqual({ items: [] });
    });

    it('should return saved staples', async () => {
      await service.updateStaples({ items: ['salt', 'pepper'] });
      expect(await service.getStaples()).toEqual({ items: ['salt', 'pepper'] });
    });
  });

  describe('updateStaples', () => {
    it('should save and return the staples list', async () => {
      const config = { items: ['salt', 'pepper', 'olive oil'] };
      expect(await service.updateStaples(config)).toEqual(config);
      expect(await service.getStaples()).toEqual(config);
    });

    it('should write to the single default row rather than creating many', async () => {
      await service.updateStaples({ items: ['salt'] });
      await service.updateStaples({ items: ['pepper'] });

      expect(prisma.staplesConfig.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.row()?.id).toBe('default');
      expect(await service.getStaples()).toEqual({ items: ['pepper'] });
    });
  });

  describe('isStaple', () => {
    it('should return true for a staple item (case-insensitive)', async () => {
      await service.updateStaples({ items: ['Salt', 'Pepper'] });

      expect(await service.isStaple('salt')).toBe(true);
      expect(await service.isStaple('SALT')).toBe(true);
      expect(await service.isStaple('Salt')).toBe(true);
    });

    it('should return false for a non-staple item', async () => {
      await service.updateStaples({ items: ['Salt'] });
      expect(await service.isStaple('Flour')).toBe(false);
    });

    it('should return false when no staples configured', async () => {
      expect(await service.isStaple('Salt')).toBe(false);
    });
  });
});
