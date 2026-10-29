-- Spirits and liqueurs get their own shelf instead of sharing "beverages" with
-- juice and soda, now that recipes can be cocktails.
--
-- A new enum value, not a new column, so no existing row changes: nothing is
-- tagged 'alcohol' until someone files it so. Rows already in 'beverages' stay
-- there — whether a bottle of Malibu or a carton of juice is not something SQL
-- can tell, so re-filing them is left to the person who owns the kitchen.
ALTER TYPE "PantryCategory" ADD VALUE 'alcohol' AFTER 'beverages';
