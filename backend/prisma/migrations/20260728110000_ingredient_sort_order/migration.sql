-- Give recipe ingredients an author-defined order.
--
-- Reads previously had no ORDER BY at all, then were pinned to `id` (a random
-- uuid) so that positional translation payloads stayed stable. Stable, but
-- arbitrary: not the order the ingredients were entered in.
--
-- Backfilled from the current id-ascending position so nothing visibly
-- reshuffles on deploy; new writes set it from the submitted array index.

ALTER TABLE "RecipeIngredient" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "RecipeIngredient" AS ri
SET "sortOrder" = ordered.position
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "recipeId" ORDER BY "id") - 1 AS position
    FROM "RecipeIngredient"
) AS ordered
WHERE ri."id" = ordered."id";

CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx"
    ON "RecipeIngredient"("recipeId", "sortOrder");
