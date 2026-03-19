import { StaplesService } from './staples.service';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('StaplesService', () => {
  let service: StaplesService;
  const testDir = path.join(process.cwd(), 'data', 'config');
  const testFile = path.join(testDir, 'staples.json');

  beforeEach(async () => {
    service = new StaplesService();
    // Clean up test file
    try {
      await fs.unlink(testFile);
    } catch {
      // File may not exist
    }
  });

  afterAll(async () => {
    try {
      await fs.unlink(testFile);
    } catch {
      // Clean up
    }
  });

  describe('getStaples', () => {
    it('should return default empty list when no config exists', async () => {
      const result = await service.getStaples();
      expect(result).toEqual({ items: [] });
    });

    it('should return saved staples', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(
        testFile,
        JSON.stringify({ items: ['salt', 'pepper'] }),
      );

      const result = await service.getStaples();
      expect(result).toEqual({ items: ['salt', 'pepper'] });
    });
  });

  describe('updateStaples', () => {
    it('should save and return the staples list', async () => {
      const config = { items: ['salt', 'pepper', 'olive oil'] };
      const result = await service.updateStaples(config);

      expect(result).toEqual(config);

      // Verify it was persisted
      const saved = await service.getStaples();
      expect(saved).toEqual(config);
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
