-- Local mirror of mhylle.com identities.
--
-- Keyed on the SSO subject, not the email. An address can change and a subject
-- cannot; keying on email would strand a user's data the day they change it.
-- email and displayName are a display cache, refreshed from the token on every
-- authenticated request — the auth-service remains authoritative.

CREATE TABLE "User" (
  "id"          TEXT NOT NULL,
  "ssoSubject"  TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- The join key. Also what makes the concurrent-first-login race resolvable:
-- the loser gets P2002 and re-reads the winner's row.
CREATE UNIQUE INDEX "User_ssoSubject_key" ON "User"("ssoSubject");

-- Looking someone up by address is how sharing invitations will work.
CREATE INDEX "User_email_idx" ON "User"("email");

-- Martin Hylleberg. Seeded here rather than left to just-in-time provisioning
-- because the next migration attributes all pre-existing recipes and the whole
-- existing pantry to him, and cannot do that before the row exists.
INSERT INTO "User" ("id", "ssoSubject", "email", "displayName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '97f9ac37-13ef-4bef-964a-5da09d776497',
  'mhylle@yahoo.com',
  'Martin Hylleberg',
  now(),
  now()
)
ON CONFLICT ("ssoSubject") DO NOTHING;
