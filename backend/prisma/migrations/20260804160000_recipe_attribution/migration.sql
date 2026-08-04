-- Who added each recipe.
--
-- Attribution, not access control: every user still sees every recipe. The
-- column exists so the detail page can show a byline.

ALTER TABLE "Recipe" ADD COLUMN "createdById" TEXT;

-- Every recipe here predates user accounts. They are the household's, and the
-- household's account is Martin's.
DO $$
DECLARE
  martin_id TEXT;
BEGIN
  SELECT "id" INTO martin_id FROM "User"
   WHERE "ssoSubject" = '97f9ac37-13ef-4bef-964a-5da09d776497';

  IF martin_id IS NULL THEN
    RAISE EXCEPTION 'Cannot attribute recipes: the seeded owner is missing.';
  END IF;

  UPDATE "Recipe" SET "createdById" = martin_id WHERE "createdById" IS NULL;
END $$;

DO $$
DECLARE
  unattributed INT;
BEGIN
  SELECT count(*) INTO unattributed FROM "Recipe" WHERE "createdById" IS NULL;
  IF unattributed > 0 THEN
    RAISE EXCEPTION 'Attribution incomplete: % recipe(s) have no author', unattributed;
  END IF;
END $$;

ALTER TABLE "Recipe" ALTER COLUMN "createdById" SET NOT NULL;

-- RESTRICT, deliberately. ON DELETE CASCADE here would mean removing a person
-- deletes the family's cookbook — the same class of mistake as the 2026-06-28
-- ON DELETE incident.
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Recipe_createdById_idx" ON "Recipe"("createdById");
