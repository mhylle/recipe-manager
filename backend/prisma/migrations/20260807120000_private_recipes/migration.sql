-- Private recipes: a recipe can be narrowed to one kitchen.
--
-- The default is false, so every existing row stays in the shared library —
-- which is exactly what it is today. Nothing becomes hidden by migrating.
ALTER TABLE "Recipe" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "pantryId" TEXT;

-- SetNull, not Cascade: deleting a kitchen must not delete the recipes written
-- in it. A private recipe left without a pantry falls back to author-only.
ALTER TABLE "Recipe"
  ADD CONSTRAINT "Recipe_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Every recipe read now carries a visibility clause.
CREATE INDEX "Recipe_isPrivate_idx" ON "Recipe"("isPrivate");
CREATE INDEX "Recipe_pantryId_idx" ON "Recipe"("pantryId");
