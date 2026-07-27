import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { DEFAULT_LOCALE, Locale, pickTranslation } from '../shared/i18n/locale.js';

/** Text a caller supplies for one language. */
export interface RecipeTranslationInput {
  locale: string;
  name: string;
  description: string;
  instructions: string[];
  /** Ingredient names, positionally aligned with the recipe's `ingredients`. */
  ingredientNames: string[];
}

const RECIPE_INCLUDE = {
  // `orderBy` is load-bearing, not cosmetic: `ingredientNames` in a translation
  // payload is aligned by POSITION, so an unordered read would attach names to
  // the wrong ingredients.
  ingredients: { include: { translations: true }, orderBy: { id: 'asc' } },
  translations: true,
} as const;

/**
 * The exact shape Prisma returns for RECIPE_INCLUDE. Derived rather than
 * hand-written so the two cannot drift, and so Prisma's own enum types line up
 * with ours instead of colliding on structurally identical string unions.
 */
type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof RECIPE_INCLUDE }>;

@Injectable()
export class RecipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Omit<Recipe, 'id'>,
    options: { sourceLocale?: Locale; translations?: RecipeTranslationInput[] } = {},
  ): Promise<Recipe> {
    const sourceLocale = options.sourceLocale ?? DEFAULT_LOCALE;
    // The flat payload IS the source-locale text; extra languages arrive in
    // `translations`. Both go into the translation tables — the base row holds no
    // prose, so there is no second copy to drift out of sync.
    const byLocale = this.mergeTranslations(data, sourceLocale, options.translations);

    const result = await this.prisma.recipe.create({
      data: {
        servings: data.servings,
        instructionImages: data.instructionImages ?? [],
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        difficulty: data.difficulty,
        tags: data.tags,
        imageUrl: data.imageUrl,
        sourceLocale,
        translations: {
          create: byLocale.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description,
            instructions: t.instructions,
          })),
        },
        ingredients: {
          create: data.ingredients.map((ing, index) => ({
            quantity: ing.quantity,
            unit: ing.unit,
            pantryCategory: ing.pantryCategory,
            translations: {
              create: byLocale.map((t) => ({
                locale: t.locale,
                name: t.ingredientNames[index] ?? ing.name,
              })),
            },
          })),
        },
      },
      include: RECIPE_INCLUDE,
    });
    return this.toInterface(result, sourceLocale);
  }

  async findAll(locale: Locale = DEFAULT_LOCALE): Promise<Recipe[]> {
    const results = await this.prisma.recipe.findMany({ include: RECIPE_INCLUDE });
    return results.map((r) => this.toInterface(r, locale));
  }

  async findById(id: string, locale: Locale = DEFAULT_LOCALE): Promise<Recipe> {
    const result = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException(`recipes with id ${id} not found`);
    }
    return this.toInterface(result, locale);
  }

  /** Every language stored for a recipe — the authoring view, not a reading view. */
  async findAllTranslations(id: string): Promise<RecipeTranslationInput[]> {
    const result = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException(`recipes with id ${id} not found`);
    }
    return result.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
      instructions: t.instructions,
      ingredientNames: result.ingredients.map(
        (ing) => ing.translations.find((it) => it.locale === t.locale)?.name ?? '',
      ),
    }));
  }

  async update(
    id: string,
    data: Partial<Recipe>,
    options: { locale?: Locale; translations?: RecipeTranslationInput[] } = {},
  ): Promise<Recipe> {
    const existing = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException(`recipes with id ${id} not found`);
    }

    // Text in the payload edits the locale the caller is VIEWING in, not the
    // source locale — otherwise a Danish reader's edit would silently overwrite
    // the English text.
    const editLocale: Locale = options.locale ?? (existing.sourceLocale as Locale);

    const updateData: Record<string, unknown> = {};
    if (data.servings !== undefined) updateData.servings = data.servings;
    if (data.instructionImages !== undefined) updateData.instructionImages = data.instructionImages;
    if (data.prepTime !== undefined) updateData.prepTime = data.prepTime;
    if (data.cookTime !== undefined) updateData.cookTime = data.cookTime;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.recipe.update({ where: { id }, data: updateData });
      }

      // Replacing the ingredient list drops its translations with it (cascade),
      // so recreate a name per language for each new ingredient.
      if (data.ingredients !== undefined) {
        const namesByLocale = new Map<string, string[]>();
        namesByLocale.set(
          editLocale,
          data.ingredients.map((i) => i.name),
        );
        for (const t of options.translations ?? []) {
          if (t.ingredientNames.length > 0) {
            namesByLocale.set(t.locale, t.ingredientNames);
          }
        }

        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        for (const [index, ing] of data.ingredients.entries()) {
          const names = [...namesByLocale.entries()]
            .map(([locale, list]) => ({ locale, name: list[index] }))
            .filter((n): n is { locale: string; name: string } => Boolean(n.name));
          await tx.recipeIngredient.create({
            data: {
              recipeId: id,
              quantity: ing.quantity,
              unit: ing.unit,
              pantryCategory: ing.pantryCategory,
              translations: { create: names },
            },
          });
        }
      }

      const textEdits: RecipeTranslationInput[] = [...(options.translations ?? [])];
      const hasInlineText =
        data.name !== undefined ||
        data.description !== undefined ||
        data.instructions !== undefined;
      if (hasInlineText && !textEdits.some((t) => t.locale === editLocale)) {
        const current = existing.translations.find((t) => t.locale === editLocale);
        textEdits.push({
          locale: editLocale,
          name: data.name ?? current?.name ?? '',
          description: data.description ?? current?.description ?? '',
          instructions: data.instructions ?? current?.instructions ?? [],
          ingredientNames: [],
        });
      }

      // Ingredient names for a language that is being ADDED without restating the
      // whole ingredient list. Without this, a translations-only PATCH stores the
      // prose and silently loses every ingredient name.
      if (data.ingredients === undefined) {
        for (const t of options.translations ?? []) {
          for (const [index, name] of t.ingredientNames.entries()) {
            const ingredient = existing.ingredients[index];
            if (!ingredient || !name?.trim()) {
              continue;
            }
            await tx.recipeIngredientTranslation.upsert({
              where: {
                ingredientId_locale: { ingredientId: ingredient.id, locale: t.locale },
              },
              create: { ingredientId: ingredient.id, locale: t.locale, name },
              update: { name },
            });
          }
        }
      }

      for (const t of textEdits) {
        await tx.recipeTranslation.upsert({
          where: { recipeId_locale: { recipeId: id, locale: t.locale } },
          create: {
            recipeId: id,
            locale: t.locale,
            name: t.name,
            description: t.description,
            instructions: t.instructions,
          },
          update: { name: t.name, description: t.description, instructions: t.instructions },
        });
      }
    });

    return this.findById(id, editLocale);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.recipe.delete({ where: { id } });
  }

  /** Combine the flat payload with any extra languages into one entry per locale. */
  private mergeTranslations(
    data: Omit<Recipe, 'id'>,
    sourceLocale: string,
    extra: RecipeTranslationInput[] | undefined,
  ): RecipeTranslationInput[] {
    const merged = new Map<string, RecipeTranslationInput>();
    merged.set(sourceLocale, {
      locale: sourceLocale,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      ingredientNames: data.ingredients.map((i) => i.name),
    });
    for (const t of extra ?? []) {
      merged.set(t.locale, t);
    }
    return [...merged.values()];
  }

  private toInterface(result: RecipeRow, locale: Locale): Recipe {
    // The ONLY place translations are resolved. Everything downstream keeps
    // reading `recipe.name` and never learns that locales exist.
    const t = pickTranslation(result.translations, locale, result.sourceLocale);
    return {
      id: result.id,
      name: t?.name ?? '',
      description: t?.description ?? '',
      servings: result.servings,
      instructions: t?.instructions ?? [],
      instructionImages: result.instructionImages,
      prepTime: result.prepTime,
      cookTime: result.cookTime,
      // Prisma's generated enums and ours are the same string unions declared in
      // two places; the cast asserts that, it does not paper over a mismatch.
      difficulty: result.difficulty as Recipe['difficulty'],
      tags: result.tags,
      imageUrl: result.imageUrl ?? undefined,
      ingredients: result.ingredients.map((ing) => ({
        name: pickTranslation(ing.translations, locale, result.sourceLocale)?.name ?? '',
        quantity: ing.quantity,
        unit: ing.unit as Recipe['ingredients'][0]['unit'],
        pantryCategory: ing.pantryCategory as Recipe['ingredients'][0]['pantryCategory'],
      })),
    };
  }
}
