import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShoppingList } from '../shared/interfaces/shopping-list.interface.js';

@Injectable()
export class ShoppingListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Omit<ShoppingList, 'id'>): Promise<ShoppingList> {
    const result = await this.prisma.shoppingList.create({
      data: {
        mealPlanId: data.mealPlanId,
        generatedDate: new Date(data.generatedDate),
        items: {
          create: data.items.map((item, i) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            checked: item.checked,
            sortOrder: i,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toInterface(result);
  }

  async findById(id: string): Promise<ShoppingList> {
    const result = await this.prisma.shoppingList.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!result) {
      throw new NotFoundException(`shopping-lists with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  async update(id: string, data: Partial<ShoppingList>): Promise<ShoppingList> {
    await this.findById(id);

    if (data.items !== undefined) {
      await this.prisma.shoppingListItem.deleteMany({
        where: { shoppingListId: id },
      });
      await this.prisma.shoppingListItem.createMany({
        data: data.items.map((item, i) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          checked: item.checked,
          shoppingListId: id,
          sortOrder: i,
        })),
      });
    }

    return this.findById(id);
  }

  async toggleItemByIndex(id: string, index: number): Promise<ShoppingList> {
    const items = await this.prisma.shoppingListItem.findMany({
      where: { shoppingListId: id },
      orderBy: { sortOrder: 'asc' },
    });
    if (index < 0 || index >= items.length) {
      return this.findById(id);
    }
    await this.prisma.shoppingListItem.update({
      where: { id: items[index].id },
      data: { checked: !items[index].checked },
    });
    return this.findById(id);
  }

  async findAll(): Promise<ShoppingList[]> {
    const results = await this.prisma.shoppingList.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return results.map((r) => this.toInterface(r));
  }

  private toInterface(result: Record<string, unknown>): ShoppingList {
    const r = result as {
      id: string;
      mealPlanId: string;
      generatedDate: Date;
      items: Array<{
        name: string;
        quantity: number;
        unit: string;
        checked: boolean;
      }>;
    };
    return {
      id: r.id,
      mealPlanId: r.mealPlanId,
      generatedDate: r.generatedDate.toISOString(),
      items: r.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit as ShoppingList['items'][0]['unit'],
        checked: item.checked,
      })),
    };
  }
}
