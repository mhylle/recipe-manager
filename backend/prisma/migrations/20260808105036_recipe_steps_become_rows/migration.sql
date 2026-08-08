-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStepTranslation" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeStepTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_idx" ON "RecipeStep"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_sortOrder_key" ON "RecipeStep"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeStepTranslation_locale_idx" ON "RecipeStepTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStepTranslation_stepId_locale_key" ON "RecipeStepTranslation"("stepId", "locale");

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStepTranslation" ADD CONSTRAINT "RecipeStepTranslation_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RecipeStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Move the method out of two parallel arrays and into rows with identities.
--
-- Today step N's text is RecipeTranslation.instructions[N] in each locale, and
-- its photograph is Recipe.instructionImages[N] — two arrays in two tables held
-- together by nothing but position. This copies them across WITHOUT shifting
-- anything, because a shift here silently reattaches every photograph to the
-- wrong step and there is no way to notice from the outside.
--
-- Postgres arrays are 1-based; sortOrder is 0-based. That is the whole reason
-- for the +1 / -1 below, and getting it backwards is the failure mode.
--
-- The old columns are NOT dropped here. Copy and drop in one migration leaves no
-- way back if the copy is wrong, and this project has already destroyed the
-- Danish text of eleven recipes once. They go in a follow-up, after this is
-- verified on production.
-- ---------------------------------------------------------------------------

-- How many steps a recipe has is decided by its SOURCE locale, which is the one
-- guaranteed to be complete: reads already fall back to it when a translation is
-- missing, so it is the only count that cannot invent or lose a step.
INSERT INTO "RecipeStep" ("id", "recipeId", "sortOrder", "imageUrl")
SELECT
    gen_random_uuid(),
    r."id",
    g.i - 1,
    -- Out of range yields NULL rather than an error, which is exactly right for
    -- a recipe with fewer photographs than steps (the ciabatta: 18 steps, 13
    -- images). NULLIF because a failed image regeneration has been known to
    -- leave an empty string behind rather than removing the entry.
    NULLIF(r."instructionImages"[g.i], '')
FROM "Recipe" r
JOIN "RecipeTranslation" t
  ON t."recipeId" = r."id" AND t."locale" = r."sourceLocale"
CROSS JOIN LATERAL generate_series(1, COALESCE(array_length(t."instructions", 1), 0)) AS g(i);

-- Every locale's text for those steps, matched by position.
--
-- A locale with FEWER entries than the source contributes nothing for the tail
-- rather than shifting its remaining text onto later steps. The missing rows
-- then fall back to the source locale on read, which is what happens today.
INSERT INTO "RecipeStepTranslation" ("id", "stepId", "locale", "text")
SELECT
    gen_random_uuid(),
    s."id",
    t."locale",
    t."instructions"[s."sortOrder" + 1]
FROM "RecipeStep" s
JOIN "RecipeTranslation" t ON t."recipeId" = s."recipeId"
WHERE t."instructions"[s."sortOrder" + 1] IS NOT NULL;
