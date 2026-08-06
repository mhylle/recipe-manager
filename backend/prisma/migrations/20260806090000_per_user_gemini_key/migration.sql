-- Per-user Gemini keys, and the end of the shared one.
--
-- Image generation ran on a single GEMINI_API_KEY, which meant every contributor
-- spent the owner's money. Once anyone could register that became unbounded, so
-- the shared key is being removed outright rather than kept as a fallback. Each
-- cook now brings their own; a cook without one uploads their own photographs.
--
-- The key is encrypted in the BROWSER with a passphrase the server never sees,
-- so what lands here is opaque to us. Deliberately one TEXT column holding a
-- JSON envelope (version, PBKDF2 salt, AES-GCM nonce, ciphertext) rather than a
-- column per parameter: changing the KDF or the cipher then becomes a version
-- bump the client understands, instead of another migration.
--
-- Nothing to backfill. Existing recipes keep the images already generated for
-- them — those are files on disk, not something this column feeds.
ALTER TABLE "User" ADD COLUMN "geminiKeyEnvelope" TEXT;
ALTER TABLE "User" ADD COLUMN "geminiKeyUpdatedAt" TIMESTAMP(3);
