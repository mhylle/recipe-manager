-- Variations: the same recipe, cooked another way, and why.
--
-- MealPlanEntry gains a nullable "variationId". Every row that already exists
-- gets NULL, and NULL means "the recipe as written" — which is the only thing
-- those rows could ever have meant, since no variation existed to choose. It
-- stays the meaning for any recipe that has none, so no backfill is needed and
-- none would be correct.
--
-- ON DELETE SET NULL, not CASCADE: deleting a variation must not delete the
-- meals somebody planned. They fall back to the base recipe — a worse answer
-- than the one intended, a far better one than a missing dinner.

-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN     "variationId" TEXT;

-- CreateTable
CREATE TABLE "RecipeVariation" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "prepTime" INTEGER,
    "cookTime" INTEGER,

    CONSTRAINT "RecipeVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVariationTranslation" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "RecipeVariationTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVariationIngredient" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "quantity" DOUBLE PRECISION,
    "unit" "Unit",
    "pantryCategory" "PantryCategory",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeVariationIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVariationIngredientTranslation" (
    "id" TEXT NOT NULL,
    "variationIngredientId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RecipeVariationIngredientTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVariationStep" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "stepId" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "afterPosition" INTEGER,

    CONSTRAINT "RecipeVariationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVariationStepTranslation" (
    "id" TEXT NOT NULL,
    "variationStepId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeVariationStepTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeVariation_recipeId_sortOrder_idx" ON "RecipeVariation"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeVariationTranslation_locale_idx" ON "RecipeVariationTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVariationTranslation_variationId_locale_key" ON "RecipeVariationTranslation"("variationId", "locale");

-- CreateIndex
CREATE INDEX "RecipeVariationIngredient_variationId_idx" ON "RecipeVariationIngredient"("variationId");

-- CreateIndex
CREATE INDEX "RecipeVariationIngredient_ingredientId_idx" ON "RecipeVariationIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "RecipeVariationIngredientTranslation_locale_idx" ON "RecipeVariationIngredientTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVariationIngredientTranslation_variationIngredientId__key" ON "RecipeVariationIngredientTranslation"("variationIngredientId", "locale");

-- CreateIndex
CREATE INDEX "RecipeVariationStep_variationId_idx" ON "RecipeVariationStep"("variationId");

-- CreateIndex
CREATE INDEX "RecipeVariationStep_stepId_idx" ON "RecipeVariationStep"("stepId");

-- CreateIndex
CREATE INDEX "RecipeVariationStepTranslation_locale_idx" ON "RecipeVariationStepTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVariationStepTranslation_variationStepId_locale_key" ON "RecipeVariationStepTranslation"("variationStepId", "locale");

-- CreateIndex
CREATE INDEX "MealPlanEntry_variationId_idx" ON "MealPlanEntry"("variationId");

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "RecipeVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariation" ADD CONSTRAINT "RecipeVariation_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationTranslation" ADD CONSTRAINT "RecipeVariationTranslation_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "RecipeVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationIngredient" ADD CONSTRAINT "RecipeVariationIngredient_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "RecipeVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationIngredient" ADD CONSTRAINT "RecipeVariationIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationIngredientTranslation" ADD CONSTRAINT "RecipeVariationIngredientTranslation_variationIngredientId_fkey" FOREIGN KEY ("variationIngredientId") REFERENCES "RecipeVariationIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationStep" ADD CONSTRAINT "RecipeVariationStep_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "RecipeVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationStep" ADD CONSTRAINT "RecipeVariationStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RecipeStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVariationStepTranslation" ADD CONSTRAINT "RecipeVariationStepTranslation_variationStepId_fkey" FOREIGN KEY ("variationStepId") REFERENCES "RecipeVariationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
