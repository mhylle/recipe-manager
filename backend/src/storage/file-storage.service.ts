import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { NotFoundException } from '@nestjs/common';

export class FileStorageService<T extends { id: string }> {
  private readonly dataDir: string;

  constructor(
    private readonly entityName: string,
    basePath?: string,
  ) {
    this.dataDir = path.join(
      basePath ?? path.join(process.cwd(), 'data'),
      entityName,
    );
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  private getFilePath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    await this.ensureDir();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...data,
      id,
      addedDate: now,
      lastUpdated: now,
    } as unknown as T;
    const filePath = this.getFilePath(id);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
    return record;
  }

  async findById(id: string): Promise<T> {
    const filePath = this.getFilePath(id);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (this.isEnoent(error)) {
        throw new NotFoundException(
          `${this.entityName} with id ${id} not found`,
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<T[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp.json'),
      );
      const records = await Promise.all(
        jsonFiles.map(async (file) => {
          const content = await fs.readFile(
            path.join(this.dataDir, file),
            'utf-8',
          );
          return JSON.parse(content) as T;
        }),
      );
      return records;
    } catch (error) {
      if (this.isEnoent(error)) {
        return [];
      }
      throw error;
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.findById(id);
    const now = new Date().toISOString();
    const updated = { ...existing, ...data, id, lastUpdated: now } as T;
    const filePath = this.getFilePath(id);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (this.isEnoent(error)) {
        throw new NotFoundException(
          `${this.entityName} with id ${id} not found`,
        );
      }
      throw error;
    }
  }

  private isEnoent(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
    );
  }
}
