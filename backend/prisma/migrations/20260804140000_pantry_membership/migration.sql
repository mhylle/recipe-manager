-- Pantries become the unit of sharing, and all existing kitchen state moves
-- under one.
--
-- Every row in this database predates user accounts. The whole point of the
-- backfill is that nothing is left behind: an unattached pantry item is
-- invisible to every query afterwards, which looks exactly like data loss.
-- The guard at the bottom refuses to finish if that happened.

CREATE TABLE "Pantry" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pantry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PantryMember" (
  "id"       TEXT NOT NULL,
  "pantryId" TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "role"     TEXT NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PantryMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PantryMember_pantryId_userId_key" ON "PantryMember"("pantryId", "userId");
CREATE INDEX "PantryMember_userId_idx" ON "PantryMember"("userId");
CREATE INDEX "Pantry_ownerId_idx" ON "Pantry"("ownerId");

-- Restrict, not Cascade: deleting a person must not silently delete the
-- household's kitchen along with them.
ALTER TABLE "Pantry" ADD CONSTRAINT "Pantry_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PantryMember" ADD CONSTRAINT "PantryMember_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryMember" ADD CONSTRAINT "PantryMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The household pantry, owned by the user seeded in 20260804120000.
DO $$
DECLARE
  martin_id TEXT;
  pantry_id TEXT := gen_random_uuid()::text;
BEGIN
  SELECT "id" INTO martin_id FROM "User"
   WHERE "ssoSubject" = '97f9ac37-13ef-4bef-964a-5da09d776497';

  IF martin_id IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate: the seeded owner is missing. Migration 20260804120000 must run first.';
  END IF;

  INSERT INTO "Pantry" ("id", "name", "ownerId", "createdAt", "updatedAt")
  VALUES (pantry_id, 'Hjemme', martin_id, now(), now());

  INSERT INTO "PantryMember" ("id", "pantryId", "userId", "role", "joinedAt")
  VALUES (gen_random_uuid()::text, pantry_id, martin_id, 'owner', now());

  -- Columns are added nullable, backfilled, then made NOT NULL. Adding them
  -- NOT NULL outright would fail on any non-empty table.
  ALTER TABLE "PantryItem"   ADD COLUMN "pantryId" TEXT;
  ALTER TABLE "MealPlan"     ADD COLUMN "pantryId" TEXT;
  ALTER TABLE "ShoppingList" ADD COLUMN "pantryId" TEXT;

  UPDATE "PantryItem"   SET "pantryId" = pantry_id;
  UPDATE "MealPlan"     SET "pantryId" = pantry_id;
  UPDATE "ShoppingList" SET "pantryId" = pantry_id;

  -- StaplesConfig was a single global row keyed 'default'. It becomes one row
  -- per pantry, carrying the existing list across.
  ALTER TABLE "StaplesConfig" ADD COLUMN "pantryId" TEXT;
  UPDATE "StaplesConfig" SET "pantryId" = pantry_id;
  -- Give the pantry an empty staples row if there was never a global one, so
  -- the read path has nothing to special-case.
  INSERT INTO "StaplesConfig" ("id", "pantryId", "items")
  SELECT gen_random_uuid()::text, pantry_id, ARRAY[]::text[]
  WHERE NOT EXISTS (SELECT 1 FROM "StaplesConfig" WHERE "pantryId" = pantry_id);
END $$;

-- Refuse to finish if anything was left behind. A partially migrated table
-- hides exactly the rows it missed.
DO $$
DECLARE
  orphans INT;
BEGIN
  SELECT
      (SELECT count(*) FROM "PantryItem"    WHERE "pantryId" IS NULL)
    + (SELECT count(*) FROM "MealPlan"      WHERE "pantryId" IS NULL)
    + (SELECT count(*) FROM "ShoppingList"  WHERE "pantryId" IS NULL)
    + (SELECT count(*) FROM "StaplesConfig" WHERE "pantryId" IS NULL)
  INTO orphans;

  IF orphans > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % row(s) left with no pantry', orphans;
  END IF;
END $$;

ALTER TABLE "PantryItem"    ALTER COLUMN "pantryId" SET NOT NULL;
ALTER TABLE "MealPlan"      ALTER COLUMN "pantryId" SET NOT NULL;
ALTER TABLE "ShoppingList"  ALTER COLUMN "pantryId" SET NOT NULL;
ALTER TABLE "StaplesConfig" ALTER COLUMN "pantryId" SET NOT NULL;

-- StaplesConfig.id was a text key defaulting to 'default'; it is a uuid now.
ALTER TABLE "StaplesConfig" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaplesConfig" ADD CONSTRAINT "StaplesConfig_pantryId_fkey"
  FOREIGN KEY ("pantryId") REFERENCES "Pantry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PantryItem_pantryId_idx"   ON "PantryItem"("pantryId");
CREATE INDEX "ShoppingList_pantryId_idx" ON "ShoppingList"("pantryId");
CREATE INDEX "MealPlan_pantryId_idx"     ON "MealPlan"("pantryId");
CREATE UNIQUE INDEX "StaplesConfig_pantryId_key" ON "StaplesConfig"("pantryId");

-- The week was globally unique, which would have stopped a second household
-- planning a week the first had already planned.
DROP INDEX IF EXISTS "MealPlan_weekStartDate_key";
CREATE UNIQUE INDEX "MealPlan_pantryId_weekStartDate_key" ON "MealPlan"("pantryId", "weekStartDate");
