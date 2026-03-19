import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StaplesConfig } from '../shared/interfaces/staples-config.interface.js';

@Injectable()
export class StaplesService {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'config', 'staples.json');
  }

  async getStaples(): Promise<StaplesConfig> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as StaplesConfig;
    } catch {
      return { items: [] };
    }
  }

  async updateStaples(config: StaplesConfig): Promise<StaplesConfig> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  async isStaple(ingredientName: string): Promise<boolean> {
    const config = await this.getStaples();
    return config.items.some(
      (item) => item.toLowerCase() === ingredientName.toLowerCase(),
    );
  }
}
