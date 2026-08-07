import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StaplesConfig } from '../shared/interfaces/staples-config.interface.js';

@Injectable()
export class StaplesService {
  constructor(private readonly prisma: PrismaService) {}

  async getStaples(pantryId: string): Promise<StaplesConfig> {
    const result = await this.prisma.staplesConfig.findUnique({
      where: { pantryId },
    });
    // A pantry created before it had a staples row, or one whose row was never
    // written, reads as an empty list rather than an error.
    return result ? { items: result.items } : { items: [] };
  }

  async updateStaples(
    pantryId: string,
    config: StaplesConfig,
  ): Promise<StaplesConfig> {
    const result = await this.prisma.staplesConfig.upsert({
      where: { pantryId },
      update: { items: config.items },
      create: { pantryId, items: config.items },
    });
    return { items: result.items };
  }

  async isStaple(pantryId: string, ingredientName: string): Promise<boolean> {
    const config = await this.getStaples(pantryId);
    return config.items.some(
      (item) => item.toLowerCase() === ingredientName.toLowerCase(),
    );
  }
}
