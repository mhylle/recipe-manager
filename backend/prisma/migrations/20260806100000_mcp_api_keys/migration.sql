-- Per-user MCP credentials, replacing one shared bearer token.
--
-- The shared RECIPE_MANAGER_MCP_TOKEN made every MCP write look like the owner's,
-- and could not be revoked for one person without breaking everyone. A personal
-- key both authenticates to the MCP endpoint and identifies the caller, so an
-- assistant's writes are attributed correctly and the contribution gate applies
-- per person.

-- Cached answer to "may this person write to the shared library?".
--
-- The JWT's `apps` claim stays authoritative for any request carrying a token.
-- This column is for callers that have none — an MCP key cannot ask the
-- auth-service anything. It is refreshed on every authenticated JWT request,
-- which means a revoked grant keeps working over MCP until that person next signs
-- in through the browser. Acceptable for a household cookbook; written down here
-- because it would not be for anything larger.
--
-- Defaults to false, so a user who has not signed in since this shipped cannot
-- contribute over MCP until they do. Fails closed.
ALTER TABLE "User" ADD COLUMN "canContribute" BOOLEAN NOT NULL DEFAULT false;

-- Only a hash is stored. The token is shown once, at creation, and no route
-- returns it again — a table that can hand back live credentials makes every
-- backup of it a set of live credentials.
CREATE TABLE "McpApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    -- Set rather than deleting the row, so a revoked key stays visible as
    -- revoked instead of vanishing and looking like it never existed.
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "McpApiKey_pkey" PRIMARY KEY ("id")
);

-- Unique, so presenting a key is one indexed lookup rather than a scan.
CREATE UNIQUE INDEX "McpApiKey_tokenHash_key" ON "McpApiKey"("tokenHash");
CREATE INDEX "McpApiKey_userId_idx" ON "McpApiKey"("userId");

-- CASCADE: a credential is disposable plumbing, unlike a recipe. Deleting a
-- person must not leave keys that authenticate as a user who no longer exists.
ALTER TABLE "McpApiKey" ADD CONSTRAINT "McpApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
