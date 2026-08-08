import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShoppingList } from '../shared/interfaces/shopping-list.interface.js';

@Injectable()
export class ShoppingListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    pantryId: string,
    data: Omit<ShoppingList, 'id'>,
  ): Promise<ShoppingList> {
    const result = await this.prisma.shoppingList.create({
      data: {
        pantryId,
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

  /**
   * Scoped: a list id from another household is a miss, not a read.
   *
   * This took a bare id and answered for any kitchen, so an id kept from a
   * shared screen — or guessed — read and ticked somebody else's shopping.
   */
  async findById(pantryId: string, id: string): Promise<ShoppingList> {
    const result = await this.prisma.shoppingList.findFirst({
      where: { id, pantryId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!result) {
      throw new NotFoundException(`shopping-lists with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  /**
   * The kitchen's current list: the newest one nobody has put away.
   *
   * Ordered explicitly. The rows have no inherent order, and this decides which
   * list the shop is done from — far too load-bearing to inherit from whatever
   * the database happens to return first.
   */
  async findCurrent(pantryId: string): Promise<ShoppingList | null> {
    const result = await this.prisma.shoppingList.findFirst({
      where: { pantryId, archivedAt: null },
      orderBy: { generatedDate: 'desc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return result ? this.toInterface(result) : null;
  }

  /** Put a list away. Scoped, because it is a write. */
  async archive(pantryId: string, id: string): Promise<ShoppingList> {
    await this.findById(pantryId, id);
    await this.prisma.shoppingList.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return this.findById(pantryId, id);
  }

  /**
   * Put away whatever the kitchen is currently shopping from.
   *
   * updateMany rather than read-then-write: two people generating at the same
   * moment would both read the same current list and one archive would be lost,
   * leaving a list that nothing shows and nothing can reach.
   */
  async archiveCurrent(pantryId: string): Promise<void> {
    await this.prisma.shoppingList.updateMany({
      where: { pantryId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  }

  async update(
    pantryId: string,
    id: string,
    data: Partial<ShoppingList>,
  ): Promise<ShoppingList> {
    await this.findById(pantryId, id);

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

    return this.findById(pantryId, id);
  }

  async toggleItemByIndex(
    pantryId: string,
    id: string,
    index: number,
  ): Promise<ShoppingList> {
    // Resolve the list inside the kitchen FIRST — ticking somebody else's
    // shopping is a write, and this is what stops it.
    await this.findById(pantryId, id);
    const items = await this.prisma.shoppingListItem.findMany({
      where: { shoppingListId: id },
      orderBy: { sortOrder: 'asc' },
    });
    if (index < 0 || index >= items.length) {
      return this.findById(pantryId, id);
    }
    await this.prisma.shoppingListItem.update({
      where: { id: items[index].id },
      data: { checked: !items[index].checked },
    });
    return this.findById(pantryId, id);
  }

  async findAll(pantryId: string): Promise<ShoppingList[]> {
    const results = await this.prisma.shoppingList.findMany({
      where: { pantryId },
      orderBy: { generatedDate: 'desc' },
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
