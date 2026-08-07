import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';
import { Difficulty } from '../shared/enums/index.js';
import {
  DEFAULT_LOCALE,
  Locale,
  SUPPORTED_LOCALES,
  isLocale,
  pickTranslation,
} from '../shared/i18n/locale.js';
import {
  normalisePageRequest,
  type PageRequest,
  type Paged,
} from '../shared/pagination.js';
import {
  visibilityWhere,
  UNRESTRICTED,
  type RecipeAudience,
} from './recipe-visibility.js';

/** Filters the recipe list accepts. Every one is applied in SQL. */
export interface RecipeSearchFilters {
  tags?: string[];
  difficulty?: Difficulty;
  maxPrepTime?: number;
  maxCookTime?: number;
  query?: string;
}

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
  // the wrong ingredients. `sortOrder` is the author's order; `id` breaks ties
  // deterministically for rows written before the column existed.
  ingredients: {
    include: { translations: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  translations: true,
  createdBy: { select: { id: true, displayName: true, email: true } },
  // `satisfies` rather than `as const`: a const assertion makes the orderBy array
  // readonly, which Prisma's argument types reject, while still giving the
  // literal types RecipeGetPayload needs below.
} satisfies Prisma.RecipeInclude;

/**
 * The exact shape Prisma returns for RECIPE_INCLUDE. Derived rather than
 * hand-written so the two cannot drift, and so Prisma's own enum types line up
 * with ours instead of colliding on structurally identical string unions.
 */
type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof RECIPE_INCLUDE }>;

/**
 * Tags in their canonical form: lowercase, trimmed, de-duplicated, sorted.
 *
 * Filtering compares them exactly in SQL now, so a stray 'Baking' alongside
 * 'baking' would make the same facet behave differently on two recipes — which
 * is exactly the drift the normalisation migration had to clean up.
 */
function canonicalTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0),
    ),
  ].sort();
}

@Injectable()
export class RecipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createdById: string,
    data: Omit<Recipe, 'id'>,
    options: {
      sourceLocale?: Locale;
      translations?: RecipeTranslationInput[];
      /** The author's kitchen, which is what a private recipe is narrowed to. */
      pantryId?: string | null;
    } = {},
  ): Promise<Recipe> {
    const sourceLocale = options.sourceLocale ?? DEFAULT_LOCALE;
    // The flat payload IS the source-locale text; extra languages arrive in
    // `translations`. Both go into the translation tables — the base row holds no
    // prose, so there is no second copy to drift out of sync.
    const byLocale = this.mergeTranslations(
      data,
      sourceLocale,
      options.translations,
    );

    const result = await this.prisma.recipe.create({
      data: {
        servings: data.servings,
        instructionImages: data.instructionImages ?? [],
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        difficulty: data.difficulty,
        tags: canonicalTags(data.tags),
        createdById,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        sourceLocale,
        isPrivate: data.isPrivate ?? false,
        // Recorded whether or not the recipe is private today, so that turning
        // privacy on later does not have to guess which kitchen was meant.
        pantryId: options.pantryId ?? null,
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
            sortOrder: index,
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

  /**
   * A page of recipes, filtered in SQL.
   *
   * Filtering used to run in JavaScript over every row. That meant reading the
   * whole table — with all ingredients and all translations — to return three
   * results, and it made pagination impossible to do honestly, because the true
   * total was only known after loading everything.
   */
  async findAll(
    filters: RecipeSearchFilters = {},
    locale: Locale = DEFAULT_LOCALE,
    page: PageRequest = {},
    audience: RecipeAudience,
  ): Promise<Paged<Recipe>> {
    const where = this.buildWhere(filters, locale, audience);
    const { limit, offset } = normalisePageRequest(page);

    // One round trip for the page, one for the count. The count must use the
    // same WHERE or `total` describes a different query than `data`.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: RECIPE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toInterface(r, locale)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Translate the filters into a Prisma WHERE.
   *
   * The text query is the awkward one. It has to match what the reader actually
   * sees, and what they see is the requested locale's translation when it exists
   * and the recipe's source-locale translation when it does not. Prisma cannot
   * compare a related row's `locale` against the parent's `sourceLocale` column,
   * so the fallback arm is expressed as "has no translation in the requested
   * locale, and some translation matches" — which, with two supported locales,
   * can only be the source translation.
   */
  private buildWhere(
    filters: RecipeSearchFilters,
    locale: Locale,
    audience: RecipeAudience,
  ): Prisma.RecipeWhereInput {
    const where: Prisma.RecipeWhereInput = {};

    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters.maxPrepTime !== undefined) {
      where.prepTime = { lte: filters.maxPrepTime };
    }
    if (filters.maxCookTime !== undefined) {
      where.cookTime = { lte: filters.maxCookTime };
    }
    if (filters.tags && filters.tags.length > 0) {
      // Tags are stored canonically lowercase (see the normalisation migration),
      // so an exact array match is now the case-insensitive match it used to be.
      where.tags = {
        hasEvery: filters.tags.map((t) => t.trim().toLowerCase()),
      };
    }

    if (filters.query) {
      const contains = filters.query;
      const matches: Prisma.RecipeTranslationWhereInput = {
        OR: [
          { name: { contains, mode: 'insensitive' } },
          { description: { contains, mode: 'insensitive' } },
        ],
      };
      where.OR = [
        { translations: { some: { locale, ...matches } } },
        {
          AND: [
            { translations: { none: { locale } } },
            { translations: { some: matches } },
          ],
        },
      ];
    }

    // Under AND rather than merged in: the text search above already owns the
    // top-level OR, and visibility needs an OR of its own. Assigning either one
    // over the other would quietly widen the read to recipes the caller may not
    // see, which is the one bug this clause exists to prevent.
    where.AND = [visibilityWhere(audience)];

    return where;
  }

  async findById(
    id: string,
    locale: Locale = DEFAULT_LOCALE,
    audience: RecipeAudience,
  ): Promise<Recipe> {
    // findFirst, not findUnique: the visibility clause is part of the lookup so
    // a recipe the caller may not read is simply not found. Fetching it and
    // then refusing would answer "this id exists and is not yours", which is
    // more than a stranger needs to learn from a URL they guessed.
    const result = await this.prisma.recipe.findFirst({
      where: { AND: [{ id }, visibilityWhere(audience)] },
      include: RECIPE_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException(`recipes with id ${id} not found`);
    }
    return this.toInterface(result, locale);
  }

  /** Every language stored for a recipe — the authoring view, not a reading view. */
  /**
   * Move a recipe's attribution to another person.
   *
   * Kept out of `update` on purpose: everything that goes through there is a
   * change to the recipe, whereas this is a change to who controls it. Letting
   * `createdById` ride along in a general update payload would mean a client
   * could reassign a recipe by adding a field to an ordinary edit.
   */
  async reassignAuthor(id: string, newAuthorId: string): Promise<Recipe> {
    const result = await this.prisma.recipe.update({
      where: { id },
      data: { createdById: newAuthorId },
      include: RECIPE_INCLUDE,
    });
    return this.toInterface(result, result.sourceLocale as Locale);
  }

  /** Just the author, for the ownership check. Avoids hydrating the whole row. */
  async findOwner(id: string): Promise<{ createdById: string } | null> {
    return this.prisma.recipe.findUnique({
      where: { id },
      select: { createdById: true },
    });
  }

  async findAllTranslations(
    id: string,
    audience: RecipeAudience,
  ): Promise<RecipeTranslationInput[]> {
    // Same visibility rule as findById. This route returns the recipe's prose in
    // every language, so leaving it unfiltered would hand out the whole of a
    // private recipe to anyone who appended /translations to the URL.
    const result = await this.prisma.recipe.findFirst({
      where: { AND: [{ id }, visibilityWhere(audience)] },
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
        (ing) =>
          ing.translations.find((it) => it.locale === t.locale)?.name ?? '',
      ),
    }));
  }

  async update(
    id: string,
    data: Partial<Recipe>,
    options: {
      locale?: Locale;
      translations?: RecipeTranslationInput[];
      /**
       * Correct the recipe's authoring language. Needed because the initial
       * localisation migration tagged every row 'en', including recipes that
       * were actually written in Danish — leaving their fallback pointing at
       * the wrong language.
       */
      sourceLocale?: Locale;
    } = {},
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
    const editLocale: Locale =
      options.locale ?? (existing.sourceLocale as Locale);

    const updateData: Record<string, unknown> = {};
    if (data.servings !== undefined) updateData.servings = data.servings;
    if (data.instructionImages !== undefined)
      updateData.instructionImages = data.instructionImages;
    if (data.prepTime !== undefined) updateData.prepTime = data.prepTime;
    if (data.cookTime !== undefined) updateData.cookTime = data.cookTime;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.tags !== undefined) updateData.tags = canonicalTags(data.tags);
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    // Null is meaningful here — "conversion failed, fall back to the full
    // image" — so this checks for undefined rather than falsiness.
    if (data.thumbnailUrl !== undefined)
      updateData.thumbnailUrl = data.thumbnailUrl;
    if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
    // Null is meaningful: it un-pins a recipe from a kitchen, which for a
    // private one leaves it readable by its author alone.
    if (data.pantryId !== undefined) updateData.pantryId = data.pantryId;
    if (options.sourceLocale !== undefined) {
      // Reject anything outside the supported set. An unrecognised sourceLocale
      // is worse than useless: reads fall back to it, so a junk value silently
      // breaks the fallback chain for that recipe forever.
      if (!isLocale(options.sourceLocale)) {
        throw new BadRequestException(
          `sourceLocale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
        );
      }
      updateData.sourceLocale = options.sourceLocale;
    }

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
            .filter((n): n is { locale: string; name: string } =>
              Boolean(n.name),
            );
          await tx.recipeIngredient.create({
            data: {
              recipeId: id,
              sortOrder: index,
              quantity: ing.quantity,
              unit: ing.unit,
              pantryCategory: ing.pantryCategory,
              translations: { create: names },
            },
          });
        }
      }

      const textEdits: RecipeTranslationInput[] = [
        ...(options.translations ?? []),
      ];
      const hasInlineText =
        data.name !== undefined ||
        data.description !== undefined ||
        data.instructions !== undefined;
      if (hasInlineText && !textEdits.some((t) => t.locale === editLocale)) {
        const current = existing.translations.find(
          (t) => t.locale === editLocale,
        );
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
                ingredientId_locale: {
                  ingredientId: ingredient.id,
                  locale: t.locale,
                },
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
          update: {
            name: t.name,
            description: t.description,
            instructions: t.instructions,
          },
        });
      }
    });

    // Re-read to return the updated row. Unrestricted because ownership was
    // already checked before the write — filtering here would hide an author's
    // own recipe from them the moment they made it private.
    return this.findById(id, editLocale, UNRESTRICTED);
  }

  async delete(id: string): Promise<void> {
    // Existence check only, after the caller's ownership was verified.
    await this.findById(id, DEFAULT_LOCALE, UNRESTRICTED);
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
      thumbnailUrl: result.thumbnailUrl ?? undefined,
      // Attribution for the byline. Only the display name travels — the address
      // is not the reader's business.
      createdBy: result.createdBy
        ? { id: result.createdBy.id, displayName: result.createdBy.displayName }
        : undefined,
      // Sent so the UI can badge a private recipe without a second request.
      // Only ever reaches someone allowed to read the row at all.
      isPrivate: result.isPrivate,
      pantryId: result.pantryId,
      ingredients: result.ingredients.map((ing) => ({
        name:
          pickTranslation(ing.translations, locale, result.sourceLocale)
            ?.name ?? '',
        quantity: ing.quantity,
        unit: ing.unit as Recipe['ingredients'][0]['unit'],
        pantryCategory:
          ing.pantryCategory as Recipe['ingredients'][0]['pantryCategory'],
      })),
    };
  }
}
