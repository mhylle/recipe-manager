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
import type { RecipeVariationDto } from './dto/variation.dto.js';
import {
  applyVariation,
  type BaseIngredient,
  type BaseStep,
  type ResolvedVariation,
} from './recipe-variation.js';

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
  // Same reasoning as ingredients, and then some: callers receive the method as
  // a positional array, so the order rows come back in IS the order the cook
  // reads. Ordering here rather than sorting later keeps one source of truth.
  steps: {
    include: { translations: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  // A variation stores only differences, so it is small — and reading it with
  // the recipe is what lets one query answer "cooked this way" without a second
  // round trip per variation.
  variations: {
    include: {
      translations: true,
      ingredients: { include: { translations: true } },
      steps: { include: { translations: true } },
    },
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
/**
 * The step rows for a method, one per step of the SOURCE locale.
 *
 * The source locale decides how many steps there are, for the same reason the
 * migration used it: it is the language the recipe was written in and the one
 * reads fall back to, so it is the only count that can neither invent a step nor
 * lose one. A translation with extra entries contributes text to the steps that
 * exist and nothing more.
 */
function stepRowsFrom(
  byLocale: RecipeTranslationInput[],
  sourceLocale: string,
  images: string[] | undefined,
): {
  sortOrder: number;
  imageUrl: string | null;
  translations: { create: { locale: string; text: string }[] };
}[] {
  const source = byLocale.find((t) => t.locale === sourceLocale);
  const count = source?.instructions.length ?? 0;

  return Array.from({ length: count }, (_, index) => ({
    sortOrder: index,
    // An empty string is how the old array said "no photograph here". Stored as
    // one it would render an <img> pointing at the page itself.
    imageUrl: images?.[index]?.trim() ? images[index] : null,
    translations: {
      create: byLocale
        .map((t) => ({ locale: t.locale, text: t.instructions[index] }))
        .filter((t): t is { locale: string; text: string } =>
          Boolean(t.text?.trim()),
        ),
    },
  }));
}

/** The recipe's own ingredients, before any variation touches them. */
function baseIngredientsOf(
  result: RecipeRow,
  locale: Locale,
): BaseIngredient[] {
  return result.ingredients.map((ing) => ({
    id: ing.id,
    name:
      pickTranslation(ing.translations, locale, result.sourceLocale)?.name ??
      '',
    quantity: ing.quantity,
    unit: ing.unit as BaseIngredient['unit'],
    pantryCategory: ing.pantryCategory as BaseIngredient['pantryCategory'],
  }));
}

/** The recipe's own method, before any variation touches it. */
function baseStepsOf(result: RecipeRow, locale: Locale): BaseStep[] {
  return [...result.steps]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((step) => ({
      id: step.id,
      text:
        step.translations.find((tr) => tr.locale === locale)?.text ??
        step.translations.find((tr) => tr.locale === result.sourceLocale)
          ?.text ??
        '',
      imageUrl: step.imageUrl,
    }));
}

/** One variation, with its prose resolved to the reader's language. */
function resolveVariation(
  variation: RecipeRow['variations'][number],
  locale: Locale,
  sourceLocale: string,
): ResolvedVariation {
  const t = pickTranslation(variation.translations, locale, sourceLocale);
  return {
    id: variation.id,
    name: t?.name ?? '',
    note: t?.note ?? '',
    prepTime: variation.prepTime,
    cookTime: variation.cookTime,
    ingredients: variation.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      removed: ing.removed,
      name:
        pickTranslation(ing.translations, locale, sourceLocale)?.name ?? null,
      quantity: ing.quantity,
      unit: ing.unit as ResolvedVariation['ingredients'][0]['unit'],
      pantryCategory:
        ing.pantryCategory as ResolvedVariation['ingredients'][0]['pantryCategory'],
      sortOrder: ing.sortOrder,
    })),
    steps: variation.steps.map((step) => ({
      stepId: step.stepId,
      removed: step.removed,
      text:
        step.translations.find((tr) => tr.locale === locale)?.text ??
        step.translations.find((tr) => tr.locale === sourceLocale)?.text ??
        null,
      afterPosition: step.afterPosition,
    })),
  };
}

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
        steps: {
          create: stepRowsFrom(byLocale, sourceLocale, data.instructionImages),
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
    variationId?: string,
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
    return this.toInterface(result, locale, variationId);
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

  /**
   * The author and the recipe's kitchen, for the ownership and privacy checks.
   *
   * Avoids hydrating the whole row. `pantryId` rides along because turning a
   * recipe private needs to know whether it already belongs to a kitchen — and
   * a second query to find that out would be a second round trip on every write.
   */
  async findOwner(
    id: string,
  ): Promise<{ createdById: string; pantryId: string | null } | null> {
    return this.prisma.recipe.findUnique({
      where: { id },
      select: { createdById: true, pantryId: true },
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

      // The method, as rows. Upserted by position rather than deleted and
      // recreated: a variation points at a step id, so recreating every step on
      // save would orphan every override the first time somebody fixed a typo.
      // (Inserting a step in the MIDDLE still shifts what each position means —
      // that is the reordering problem, and it belongs to the authoring UI.)
      const stepEdits = textEdits.filter((t) => t.instructions.length > 0);
      if (stepEdits.length > 0) {
        const sourceEdit =
          stepEdits.find((t) => t.locale === existing.sourceLocale) ??
          stepEdits[0];
        const count = sourceEdit.instructions.length;
        const ids = data.stepIds;

        // Without ids, position is the only thing identifying a step — which is
        // fine for a text edit and WRONG the moment the count changes, because
        // then position N is not the step that was at position N. Variations
        // point at step ids, so guessing here silently moves an override onto a
        // different instruction. Refuse instead, and say what is missing.
        if (!ids && count !== existing.steps.length) {
          const overrides = await tx.recipeVariationStep.count({
            where: { step: { recipeId: id } },
          });
          if (overrides > 0) {
            throw new BadRequestException(
              'This recipe has variations that point at its steps, so adding or removing one needs stepIds saying which existing step each position is.',
            );
          }
        }

        for (let index = 0; index < count; index++) {
          // An id says "this position IS that step", so a move updates the row
          // rather than overwriting whatever happened to sit here.
          const namedId = ids?.[index] ?? null;
          const step = namedId
            ? await tx.recipeStep.update({
                where: { id: namedId },
                data: { sortOrder: index },
              })
            : ids
              ? await tx.recipeStep.create({
                  data: { recipeId: id, sortOrder: index },
                })
              : await tx.recipeStep.upsert({
                  where: {
                    recipeId_sortOrder: { recipeId: id, sortOrder: index },
                  },
                  create: { recipeId: id, sortOrder: index },
                  // Empty: the text is written below and the photograph is its
                  // own edit. This keeps the row and, crucially, its id.
                  update: {},
                });

          for (const t of stepEdits) {
            const text = t.instructions[index];
            if (!text?.trim()) continue;
            await tx.recipeStepTranslation.upsert({
              where: { stepId_locale: { stepId: step.id, locale: t.locale } },
              create: { stepId: step.id, locale: t.locale, text },
              update: { text },
            });
          }
        }

        // Whatever the edit did not keep. By id when the caller named them, so
        // a step that MOVED is not mistaken for one that was dropped; by
        // position otherwise, which is a method that simply got shorter.
        if (ids) {
          const kept = ids.filter((v): v is string => Boolean(v));
          await tx.recipeStep.deleteMany({
            where: { recipeId: id, id: { notIn: kept } },
          });
        } else {
          await tx.recipeStep.deleteMany({
            where: { recipeId: id, sortOrder: { gte: count } },
          });
        }
      }

      // Photographs arrive on their own, from the generator, with no text
      // alongside — so this cannot live inside the branch above or a generated
      // set would reach the deprecated array and nothing else.
      if (data.instructionImages !== undefined) {
        for (const [index, url] of data.instructionImages.entries()) {
          // An empty entry means the generator failed for that step. Skipping it
          // leaves the photograph that is already there; writing it through would
          // erase a good image on a failed regeneration, which is a data-loss
          // bug this project already has against the old array.
          if (!url?.trim()) continue;
          await tx.recipeStep.updateMany({
            where: { recipeId: id, sortOrder: index },
            data: { imageUrl: url },
          });
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
  /**
   * Replace a recipe's variations with the set given.
   *
   * Replace rather than merge: a save carries the whole set, so a variation the
   * author deleted actually disappears. Merging would leave removed ones alive
   * with nothing pointing at them from the UI — and a meal plan could still be
   * holding their ids, which is how a dinner ends up cooked a way nobody can
   * see any more.
   *
   * One transaction, because between the delete and the writes a recipe has no
   * variations at all, and a reader arriving then would be told the ciabatta has
   * only one way to make it.
   */
  async replaceVariations(
    recipeId: string,
    variations: RecipeVariationDto[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.recipeVariation.deleteMany({ where: { recipeId } });

      for (const [index, variation] of variations.entries()) {
        await tx.recipeVariation.create({
          data: {
            recipeId,
            sortOrder: variation.sortOrder ?? index,
            prepTime: variation.prepTime ?? null,
            cookTime: variation.cookTime ?? null,
            translations: {
              create: variation.texts.map((t) => ({
                locale: t.locale,
                name: t.name,
                note: t.note,
              })),
            },
            ingredients: {
              create: (variation.ingredients ?? []).map((ing, order) => ({
                // Null is meaningful: it is what distinguishes "add this" from
                // "change that". Undefined would let Prisma omit the column.
                ingredientId: ing.ingredientId ?? null,
                removed: ing.removed ?? false,
                quantity: ing.quantity ?? null,
                unit: ing.unit ?? null,
                pantryCategory: ing.pantryCategory ?? null,
                sortOrder: ing.sortOrder ?? order,
                translations: {
                  create: (ing.names ?? []).map((n) => ({
                    locale: n.locale,
                    name: n.name,
                  })),
                },
              })),
            },
            steps: {
              create: (variation.steps ?? []).map((step) => ({
                stepId: step.stepId ?? null,
                removed: step.removed ?? false,
                afterPosition: step.afterPosition ?? null,
                translations: {
                  create: (step.texts ?? []).map((t) => ({
                    locale: t.locale,
                    text: t.text,
                  })),
                },
              })),
            },
          },
        });
      }
    });
  }

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

  private toInterface(
    result: RecipeRow,
    locale: Locale,
    variationId?: string,
  ): Recipe {
    // The ONLY place translations are resolved. Everything downstream keeps
    // reading `recipe.name` and never learns that locales exist.
    const t = pickTranslation(result.translations, locale, result.sourceLocale);

    // Resolved HERE, once, rather than by each caller. A page and a shopping
    // list applying the same overrides separately is two chances to disagree
    // about what "the 10 g version" contains, and only one of them is looking.
    const chosen = variationId
      ? result.variations.find((v) => v.id === variationId)
      : undefined;
    const varied = applyVariation(
      {
        ingredients: baseIngredientsOf(result, locale),
        steps: baseStepsOf(result, locale),
        prepTime: result.prepTime,
        cookTime: result.cookTime,
      },
      chosen ? resolveVariation(chosen, locale, result.sourceLocale) : null,
    );

    return {
      id: result.id,
      name: t?.name ?? '',
      description: t?.description ?? '',
      servings: result.servings,
      instructions: varied.steps.map((s) => s.text),
      // The same steps, with the ids an override has to name.
      steps: varied.steps.map((s) => ({
        id: s.id,
        text: s.text,
        imageUrl: s.imageUrl,
      })),
      // Positional, and padded, exactly as before — an inserted step has no
      // photograph and must hold its place rather than shift the rest.
      instructionImages: varied.steps.map((s) => s.imageUrl ?? ''),
      prepTime: varied.prepTime,
      cookTime: varied.cookTime,
      variations: result.variations.length
        ? result.variations.map((v) => {
            const vt = pickTranslation(
              v.translations,
              locale,
              result.sourceLocale,
            );
            return { id: v.id, name: vt?.name ?? '', note: vt?.note ?? '' };
          })
        : undefined,
      // Only when one was actually found: asking for a variation that has been
      // deleted must not claim the payload is it.
      variationId: chosen?.id,
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
      ingredients: varied.ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        pantryCategory: ing.pantryCategory,
      })),
    };
  }
}
