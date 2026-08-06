-- Cooking timers that survive the app being closed.
--
-- The in-page countdown rings by running JavaScript, so a locked phone kills it:
-- the tab is discarded, nothing ticks, and the alarm never happens. These two
-- tables move the promise server-side — a row says "ring this person at this
-- instant", and the backend keeps it whether or not a client is alive.

-- One push endpoint per browser-on-device.
--
-- UNIQUE on "endpoint" rather than on "userId": a person cooks from a phone AND
-- a tablet, and the browser rotates the endpoint without asking. Upserting on
-- the endpoint is what keeps one row per device instead of a growing pile of
-- dead ones.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CASCADE here, deliberately unlike "Recipe".
--
-- The 2026-06-28 ON DELETE incident is the reason every cascade in this schema
-- gets a comment. This one is safe: a subscription is disposable plumbing, and
-- losing it costs the user one re-grant of notification permission. A recipe is
-- content, which is why that relation is RESTRICT.
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The timers themselves.
--
-- "title" and "body" are stored already-localised, because the client knows
-- which language the cook was reading and the backend does not. Storing a key
-- and translating at send time would need a second copy of the dictionaries
-- server-side, and would still get the recipe name wrong.
CREATE TABLE "ScheduledTimer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledTimer_pkey" PRIMARY KEY ("id")
);

-- The scheduler's only query is "unfired AND due". firedAt leads the index so
-- the already-rung rows — which is all of them, after a week of cooking — are
-- skipped rather than scanned.
CREATE INDEX "ScheduledTimer_firedAt_fireAt_idx" ON "ScheduledTimer"("firedAt", "fireAt");
CREATE INDEX "ScheduledTimer_userId_idx" ON "ScheduledTimer"("userId");

ALTER TABLE "ScheduledTimer" ADD CONSTRAINT "ScheduledTimer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
