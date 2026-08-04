import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PantryItem } from '../shared/interfaces/pantry-item.interface.js';
import { DEFAULT_LOCALE, Locale, pickTranslation } from '../shared/i18n/locale.js';

/** A pantry item's name in one language. */
export interface PantryTranslationInput {
  locale: string;
  name: string;
}

const PANTRY_INCLUDE = { translations: true } as const;

/** Derived from Prisma so the shape cannot drift from PANTRY_INCLUDE. */
type PantryRow = Prisma.PantryItemGetPayload<{ include: typeof PANTRY_INCLUDE }>;

@Injectable()
export class PantryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    pantryId: string,
    data: Omit<PantryItem, 'id' | 'addedDate' | 'lastUpdated'>,
    options: { sourceLocale?: Locale; translations?: PantryTranslationInput[] } = {},
  ): Promise<PantryItem> {
    const sourceLocale = options.sourceLocale ?? DEFAULT_LOCALE;
    const byLocale = new Map<string, string>([[sourceLocale, data.name]]);
    for (const t of options.translations ?? []) {
      byLocale.set(t.locale, t.name);
    }

    const result = await this.prisma.pantryItem.create({
      data: {
        pantryId,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category,
        barcode: data.barcode,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        sourceLocale,
        translations: {
          create: [...byLocale.entries()].map(([locale, name]) => ({ locale, name })),
        },
      },
      include: PANTRY_INCLUDE,
    });
    return this.toInterface(result, sourceLocale);
  }

  async findAll(pantryId: string, locale: Locale = DEFAULT_LOCALE): Promise<PantryItem[]> {
    const results = await this.prisma.pantryItem.findMany({
      where: { pantryId },
      include: PANTRY_INCLUDE,
    });
    return results.map((r) => this.toInterface(r, locale));
  }

  async findById(pantryId: string, id: string, locale: Locale = DEFAULT_LOCALE): Promise<PantryItem> {
    // findFirst with the pantry in the WHERE, not findUnique on the id alone:
    // an item id from another household must be a miss, not a read.
    const result = await this.prisma.pantryItem.findFirst({
      where: { id, pantryId },
      include: PANTRY_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException(`pantry with id ${id} not found`);
    }
    return this.toInterface(result, locale);
  }

  /** Every language stored for an item — the authoring view. */
  async findAllTranslations(pantryId: string, id: string): Promise<PantryTranslationInput[]> {
    const result = await this.prisma.pantryItem.findFirst({
      where: { id, pantryId },
      include: PANTRY_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException(`pantry with id ${id} not found`);
    }
    return result.translations.map((t) => ({ locale: t.locale, name: t.name }));
  }

  async update(
    pantryId: string,
    id: string,
    data: Partial<PantryItem>,
    options: { locale?: Locale; translations?: PantryTranslationInput[] } = {},
  ): Promise<PantryItem> {
    const existing = await this.prisma.pantryItem.findFirst({
      where: { id, pantryId },
      include: PANTRY_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException(`pantry with id ${id} not found`);
    }

    // A name in the payload edits the locale being viewed, not the source locale.
    const editLocale: Locale = options.locale ?? (existing.sourceLocale as Locale);

    const updateData: Record<string, unknown> = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.expiryDate !== undefined) {
      updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }

    const nameEdits = new Map<string, string>();
    if (data.name !== undefined) {
      nameEdits.set(editLocale, data.name);
    }
    for (const t of options.translations ?? []) {
      nameEdits.set(t.locale, t.name);
    }

    await this.prisma.$transaction(async (tx) => {
      // Always touch the row so `lastUpdated` reflects a name-only edit too.
      await tx.pantryItem.update({ where: { id }, data: updateData });

      for (const [locale, name] of nameEdits) {
        await tx.pantryItemTranslation.upsert({
          where: { pantryItemId_locale: { pantryItemId: id, locale } },
          create: { pantryItemId: id, locale, name },
          update: { name },
        });
      }
    });

    return this.findById(id, editLocale);
  }

  async delete(pantryId: string, id: string): Promise<void> {
    // Resolve within the pantry first, so deleting by an id belonging to
    // another household is a 404 rather than a successful destruction.
    await this.findById(pantryId, id);
    await this.prisma.pantryItem.delete({ where: { id } });
  }

  private toInterface(r: PantryRow, locale: Locale): PantryItem {
    return {
      id: r.id,
      name: pickTranslation(r.translations, locale, r.sourceLocale)?.name ?? '',
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
