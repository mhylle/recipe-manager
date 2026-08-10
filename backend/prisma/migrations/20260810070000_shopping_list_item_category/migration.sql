-- The shelf an item belongs on, so that stocking the pantry when the shopping is
-- done can file it correctly instead of dropping everything into "other".
--
-- Nullable on purpose, and that IS the decision about existing rows: a list
-- generated before this column existed never recorded a category, and there is
-- nothing to backfill it from — the recipe it came from may since have changed.
-- NULL therefore means "unknown", which the stocking code reads as `other`.
ALTER TABLE "ShoppingListItem" ADD COLUMN "category" "PantryCategory";
