-- Indexes on foreign-key columns, plus canonical lowercase tags.
--
-- Postgres creates an index for a PRIMARY KEY and for UNIQUE, but NOT for a
-- foreign key. Every one of these columns is joined on for every read of its
-- parent, and is walked again on cascade delete.
--
-- The three *Translation tables are deliberately absent: each already has a
-- UNIQUE(<fk>, locale) whose leading column serves FK lookups.

-- RecipeIngredient needs no new index: 20260728110000 already created
-- ("recipeId", "sortOrder"), and a composite also answers lookups on its
-- leading column. Adding ("recipeId") alone would cost writes and buy nothing.
CREATE INDEX IF NOT EXISTS "MealPlanEntry_mealPlanId_idx" ON "MealPlanEntry"("mealPlanId");
CREATE INDEX IF NOT EXISTS "MealPlanEntry_recipeId_idx" ON "MealPlanEntry"("recipeId");
CREATE INDEX IF NOT EXISTS "ShoppingListItem_shoppingListId_idx" ON "ShoppingListItem"("shoppingListId");

-- Recipe list filtering moved from in-memory to SQL, so these columns are now
-- in the WHERE and ORDER BY.
CREATE INDEX IF NOT EXISTS "Recipe_difficulty_idx" ON "Recipe"("difficulty");
CREATE INDEX IF NOT EXISTS "Recipe_createdAt_idx" ON "Recipe"("createdAt");

-- Tag normalisation.
--
-- Tag filtering used to run in JavaScript with .toLowerCase() on both sides, so
-- mixed casing in the data was invisible. Production had drifted to holding BOTH
-- 'Baking' and 'baking', and BOTH 'Dessert' and 'dessert'. Meanwhile the filter
-- chips send capitalised values ('Baking', 'Mexican', 'Chicken').
--
-- Moving the filter into SQL makes the comparison exact, which would have
-- silently broken every filter chip. Canonicalising to lowercase here — and on
-- write, in the repository — makes exact matching correct instead.
UPDATE "Recipe"
SET tags = (
  SELECT COALESCE(array_agg(DISTINCT lower(tag) ORDER BY lower(tag)), ARRAY[]::text[])
  FROM unnest(tags) AS tag
)
WHERE EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag <> lower(tag));

-- Refuse to finish if any mixed-case tag survived; a partially normalised table
-- would break filtering for exactly the recipes it missed.
DO $$
DECLARE
  offenders int;
BEGIN
  SELECT count(*) INTO offenders
  FROM "Recipe"
  WHERE EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag <> lower(tag));
  IF offenders > 0 THEN
    RAISE EXCEPTION 'Tag normalisation incomplete: % recipes still hold a mixed-case tag', offenders;
  END IF;
END $$;
