-- Move user-authored text into per-locale translation tables.
--
-- ORDER MATTERS: every table is created and BACKFILLED from the existing columns
-- BEFORE those columns are dropped, so the data is never in flight.
-- Existing rows are tagged sourceLocale='en' because that is what the app has
-- been storing; reads fall back to sourceLocale, so nothing renders blank.

-- 1. Source-locale markers (default 'en' applies to every existing row).
ALTER TABLE "Recipe"     ADD COLUMN "sourceLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "PantryItem" ADD COLUMN "sourceLocale" TEXT NOT NULL DEFAULT 'en';

-- 2. Translation tables.
CREATE TABLE "RecipeTranslation" (
    "id"           TEXT NOT NULL,
    "locale"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "instructions" TEXT[],
    "recipeId"     TEXT NOT NULL,
    CONSTRAINT "RecipeTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeIngredientTranslation" (
    "id"           TEXT NOT NULL,
    "locale"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    CONSTRAINT "RecipeIngredientTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PantryItemTranslation" (
    "id"           TEXT NOT NULL,
    "locale"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "pantryItemId" TEXT NOT NULL,
    CONSTRAINT "PantryItemTranslation_pkey" PRIMARY KEY ("id")
);

-- 3. BACKFILL — every existing row gets an 'en' translation carrying its text.
--    gen_random_uuid() is available in PostgreSQL 13+ without an extension.
INSERT INTO "RecipeTranslation" ("id", "locale", "name", "description", "instructions", "recipeId")
SELECT gen_random_uuid()::text, 'en', "name", "description", "instructions", "id"
FROM "Recipe";

INSERT INTO "RecipeIngredientTranslation" ("id", "locale", "name", "ingredientId")
SELECT gen_random_uuid()::text, 'en', "name", "id"
FROM "RecipeIngredient";

INSERT INTO "PantryItemTranslation" ("id", "locale", "name", "pantryItemId")
SELECT gen_random_uuid()::text, 'en', "name", "id"
FROM "PantryItem";

-- 4. Guard: abort the whole migration if any row failed to carry across.
DO $$
DECLARE missing INT;
BEGIN
    SELECT COUNT(*) INTO missing FROM "Recipe" r
      WHERE NOT EXISTS (SELECT 1 FROM "RecipeTranslation" t WHERE t."recipeId" = r."id");
    IF missing > 0 THEN RAISE EXCEPTION 'Backfill missed % Recipe row(s)', missing; END IF;

    SELECT COUNT(*) INTO missing FROM "RecipeIngredient" i
      WHERE NOT EXISTS (SELECT 1 FROM "RecipeIngredientTranslation" t WHERE t."ingredientId" = i."id");
    IF missing > 0 THEN RAISE EXCEPTION 'Backfill missed % RecipeIngredient row(s)', missing; END IF;

    SELECT COUNT(*) INTO missing FROM "PantryItem" p
      WHERE NOT EXISTS (SELECT 1 FROM "PantryItemTranslation" t WHERE t."pantryItemId" = p."id");
    IF missing > 0 THEN RAISE EXCEPTION 'Backfill missed % PantryItem row(s)', missing; END IF;
END $$;

-- 5. Only now is it safe to drop the originals.
ALTER TABLE "Recipe"           DROP COLUMN "name", DROP COLUMN "description", DROP COLUMN "instructions";
ALTER TABLE "RecipeIngredient" DROP COLUMN "name";
ALTER TABLE "PantryItem"       DROP COLUMN "name";

-- 6. Constraints and indexes.
CREATE UNIQUE INDEX "RecipeTranslation_recipeId_locale_key" ON "RecipeTranslation"("recipeId", "locale");
CREATE INDEX "RecipeTranslation_locale_idx" ON "RecipeTranslation"("locale");
CREATE UNIQUE INDEX "RecipeIngredientTranslation_ingredientId_locale_key" ON "RecipeIngredientTranslation"("ingredientId", "locale");
CREATE INDEX "RecipeIngredientTranslation_locale_idx" ON "RecipeIngredientTranslation"("locale");
CREATE UNIQUE INDEX "PantryItemTranslation_pantryItemId_locale_key" ON "PantryItemTranslation"("pantryItemId", "locale");
CREATE INDEX "PantryItemTranslation_locale_idx" ON "PantryItemTranslation"("locale");

ALTER TABLE "RecipeTranslation" ADD CONSTRAINT "RecipeTranslation_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredientTranslation" ADD CONSTRAINT "RecipeIngredientTranslation_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryItemTranslation" ADD CONSTRAINT "PantryItemTranslation_pantryItemId_fkey"
    FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
