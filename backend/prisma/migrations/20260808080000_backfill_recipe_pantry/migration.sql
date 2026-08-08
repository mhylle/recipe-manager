-- Give every recipe the kitchen it was written in.
--
-- 20260807120000 added Recipe.pantryId and never backfilled it, so every recipe
-- that already existed carried NULL. `create` sets it for new recipes, but
-- nothing set it for old ones — and the private-recipe rule reads
-- "pantryId IN (the viewer's kitchens)". With NULL, that arm can never match,
-- so marking an existing recipe private narrowed it to its author alone rather
-- than to the household. On production that was every recipe in the library.
--
-- The kitchen chosen is the author's default: the one they own, else the one
-- they joined first — the same order PantryAccessService.resolve uses when no
-- kitchen is named, so a recipe lands where a write from that author would.
--
-- Applied to public recipes too, deliberately. pantryId is only consulted when
-- isPrivate is true, so this changes nothing about who can read them today; it
-- means privacy works the moment someone turns it on, without having to guess
-- retrospectively which kitchen was meant.
UPDATE "Recipe" r
SET "pantryId" = (
  SELECT m."pantryId"
  FROM "PantryMember" m
  WHERE m."userId" = r."createdById"
  -- Booleans sort false before true, so DESC puts an owned kitchen first.
  ORDER BY (m."role" = 'owner') DESC, m."joinedAt" ASC
  LIMIT 1
)
WHERE r."pantryId" IS NULL;

-- Authors with no kitchen keep NULL. That is correct rather than a gap: there
-- is no household to narrow to, so a private recipe of theirs stays readable by
-- them alone, and never falls back to public.
