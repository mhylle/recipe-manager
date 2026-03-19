import { FileStorageService } from './file-storage.service';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface TestEntity {
  id: string;
  name: string;
  value: number;
  addedDate?: string;
  lastUpdated?: string;
}

describe('FileStorageService', () => {
  let service: FileStorageService<TestEntity>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    service = new FileStorageService<TestEntity>('test', tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should generate a UUID and write file', async () => {
      const result = await service.create({ name: 'Test Item', value: 42 });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.name).toBe('Test Item');
      expect(result.value).toBe(42);
    });

    it('should set addedDate and lastUpdated timestamps', async () => {
      const before = new Date().toISOString();
      const result = await service.create({ name: 'Test', value: 1 });
      const after = new Date().toISOString();

      expect(result.addedDate).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
      expect(result.addedDate! >= before).toBe(true);
      expect(result.addedDate! <= after).toBe(true);
    });

    it('should write a JSON file to disk', async () => {
      const result = await service.create({ name: 'Disk Test', value: 99 });
      const filePath = path.join(tempDir, 'test', `${result.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as TestEntity;

      expect(parsed.id).toBe(result.id);
      expect(parsed.name).toBe('Disk Test');
      expect(parsed.value).toBe(99);
    });

    it('should auto-create the data directory', async () => {
      const newTempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'storage-new-'),
      );
      const newService = new FileStorageService<TestEntity>(
        'newentity',
        newTempDir,
      );

      await newService.create({ name: 'First', value: 1 });

      const dirExists = await fs
        .stat(path.join(newTempDir, 'newentity'))
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);

      await fs.rm(newTempDir, { recursive: true, force: true });
    });
  });

  describe('findById', () => {
    it('should return the parsed JSON object', async () => {
      const created = await service.create({
        name: 'Find Me',
        value: 7,
      });
      const found = await service.findById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Find Me');
      expect(found.value).toBe(7);
    });

    it('should throw NotFoundException for missing record', async () => {
      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should merge fields into existing record', async () => {
      const created = await service.create({
        name: 'Original',
        value: 10,
      });
      const updated = await service.update(created.id, { name: 'Updated' });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Updated');
      expect(updated.value).toBe(10);
    });

    it('should update the lastUpdated timestamp', async () => {
      const created = await service.create({ name: 'Timestamp', value: 1 });
      const originalTimestamp = created.lastUpdated;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.update(created.id, { value: 2 });
      expect(updated.lastUpdated).not.toBe(originalTimestamp);
    });

    it('should throw NotFoundException for missing record', async () => {
      await expect(
        service.update('nonexistent-id', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow overwriting the id', async () => {
      const created = await service.create({ name: 'Keep ID', value: 1 });
      const updated = await service.update(created.id, {
        id: 'hacked-id',
      } as Partial<TestEntity>);
      expect(updated.id).toBe(created.id);
    });
  });

  describe('delete', () => {
    it('should remove the file from disk', async () => {
      const created = await service.create({
        name: 'Delete Me',
        value: 0,
      });
      await service.delete(created.id);

      const filePath = path.join(tempDir, 'test', `${created.id}.json`);
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should throw NotFoundException for missing record', async () => {
      await expect(service.delete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all records in the directory', async () => {
      await service.create({ name: 'Item 1', value: 1 });
      await service.create({ name: 'Item 2', value: 2 });
      await service.create({ name: 'Item 3', value: 3 });

      const all = await service.findAll();
      expect(all).toHaveLength(3);
      const names = all.map((item) => item.name).sort();
      expect(names).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should return empty array for empty directory', async () => {
      // Ensure directory exists but is empty
      await fs.mkdir(path.join(tempDir, 'test'), { recursive: true });
      const all = await service.findAll();
      expect(all).toEqual([]);
    });

    it('should return empty array when directory does not exist', async () => {
      const nonExistentService = new FileStorageService<TestEntity>(
        'nodir',
        tempDir,
      );
      const all = await nonExistentService.findAll();
      expect(all).toEqual([]);
    });
  });

  describe('concurrent write safety', () => {
    it('should handle concurrent creates without corruption', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.create({ name: `Concurrent ${i}`, value: i }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(10);

      const all = await service.findAll();
      expect(all).toHaveLength(10);
    });
  });
});
