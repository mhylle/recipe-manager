import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StaplesConfig } from '../shared/interfaces/staples-config.interface.js';

@Injectable()
export class StaplesService {
  constructor(private readonly prisma: PrismaService) {}

  async getStaples(): Promise<StaplesConfig> {
    const result = await this.prisma.staplesConfig.findUnique({
      where: { id: 'default' },
    });
    return result ? { items: result.items } : { items: [] };
  }

  async updateStaples(config: StaplesConfig): Promise<StaplesConfig> {
    const result = await this.prisma.staplesConfig.upsert({
      where: { id: 'default' },
      update: { items: config.items },
      create: { id: 'default', items: config.items },
    });
    return { items: result.items };
  }

  async isStaple(ingredientName: string): Promise<boolean> {
    const config = await this.getStaples();
    return config.items.some(
      (item) => item.toLowerCase() === ingredientName.toLowerCase(),
    );
  }
}
