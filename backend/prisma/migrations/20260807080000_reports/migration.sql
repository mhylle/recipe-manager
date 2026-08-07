-- Defect and improvement reports from inside the app.
--
-- The row is the record; GitHub is a mirror of it. The write happens first and
-- unconditionally, because an unreachable API, a missing token or a rate limit
-- must never lose somebody's bug report — the entire value of the button is that
-- reporting is frictionless enough to get used at all.
CREATE TYPE "ReportKind" AS ENUM ('defect', 'improvement');

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    -- What they were looking at. Saves a round trip of "where were you?".
    "pagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Mirror state. A null issue number means "not on GitHub", for any reason;
    -- githubError says which reason, so an unsynced report can be explained
    -- rather than looking like nobody cared.
    "githubIssueNumber" INTEGER,
    "githubIssueUrl" TEXT,
    "githubSyncedAt" TIMESTAMP(3),
    "githubError" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- RESTRICT, deliberately. Deleting a person must not erase the defects they
-- found, which may still be open — the same reasoning as Recipe.createdById.
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
