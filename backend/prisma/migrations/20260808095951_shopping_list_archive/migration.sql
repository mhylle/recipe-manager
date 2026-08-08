-- A shopping list can now be put away when you are done with it.
--
-- Every existing row gets NULL, and NULL means "this is the current list". That
-- is the right reading for rows that predate this column: each was a live list
-- for its kitchen and none of them was ever archived. No backfill is needed, but
-- the decision is recorded here rather than left to be inferred, because the
-- current-list read below branches on this column.
--
-- The pile of pre-existing lists per kitchen is handled by the read, which takes
-- the NEWEST unarchived one — not by rewriting history here.
-- AlterTable
ALTER TABLE "ShoppingList" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ShoppingList_pantryId_archivedAt_idx" ON "ShoppingList"("pantryId", "archivedAt");
