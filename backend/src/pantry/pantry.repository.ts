import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';

@Injectable()
export class PantryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Omit<PantryItem, 'id' | 'addedDate' | 'lastUpdated'>,
  ): Promise<PantryItem> {
    const result = await this.prisma.pantryItem.create({
      data: {
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category,
        barcode: data.barcode,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
    });
    return this.toInterface(result);
  }

  async findAll(): Promise<PantryItem[]> {
    const results = await this.prisma.pantryItem.findMany();
    return results.map((r) => this.toInterface(r));
  }

  async findById(id: string): Promise<PantryItem> {
    const result = await this.prisma.pantryItem.findUnique({
      where: { id },
    });
    if (!result) {
      throw new NotFoundException(`pantry with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  async update(id: string, data: Partial<PantryItem>): Promise<PantryItem> {
    await this.findById(id);
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.expiryDate !== undefined) {
      updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }

    const result = await this.prisma.pantryItem.update({
      where: { id },
      data: updateData,
    });
    return this.toInterface(result);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.pantryItem.delete({ where: { id } });
  }

  private toInterface(result: Record<string, unknown>): PantryItem {
    const r = result as {
      id: string;
      name: string;
      quantity: number;
      unit: string;
      category: string;
      barcode: string | null;
      expiryDate: Date | null;
      addedDate: Date;
      lastUpdated: Date;
    };
    return {
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit as PantryItem['unit'],
      category: r.category as PantryItem['category'],
      barcode: r.barcode ?? undefined,
      expiryDate: r.expiryDate?.toISOString(),
      addedDate: r.addedDate.toISOString(),
      lastUpdated: r.lastUpdated.toISOString(),
    };
  }
}
