# Implementation plan — bring-your-own keys, and MCP onboarding

Structured for import into tasktracker: each `## Phase` becomes a phase task, each
`### Task` a task, each `- [ ]` a subtask. Status markers are kept current as work
lands, so this file is the source of truth until tasktracker is reachable again
(its API key 401s as of 2026-08-06).

**Requirement it serves.** Image generation ran on one shared `GEMINI_API_KEY`, so
every contributor spent the owner's money — unbounded once anyone could register.
And the MCP server had one shared bearer token, so every MCP write was attributed
to the owner. Both become per-user, and the MCP gets a front-page guide so a new
cook can wire up their own AI without the owner doing anything.

**Cross-cutting constraints**

- There is to be **no shared generation credential**, and no "fall back to the
  owner's key" path, however convenient. A cook without a key uploads their own
  photographs. (See `no-shared-gemini-key` in project memory.)
- The stored Gemini key is encrypted **in the browser** with a passphrase the
  server never sees. The server stores ciphertext, cannot decrypt it, and must
  never try. It does receive the plaintext key on a generation request — this is
  zero-knowledge **at rest**, not end-to-end, and must not be described as more.
- Every new controller gets registered in `guard-coverage.spec.ts`. Two
  controllers were added earlier without it and went unverified.
- Verification is repo-wide, never diff-scoped: full build, full test suite, full
  i18n check on both projects.

---

## Phase A — Per-user Gemini key

Retire the shared key; each user brings their own, encrypted at rest.

### Task A1 — Backend (DONE)

- [x] `User.geminiKeyEnvelope` + `geminiKeyUpdatedAt`, migration `20260806090000_per_user_gemini_key`
- [x] `ImageGenerationService` takes the key per call; client built per request, never cached
- [x] Log scrubbing, so a caller's key cannot reach a log line
- [x] `create` no longer generates images — nothing to charge without a key
- [x] `regenerate-images` accepts `{ apiKey }`; service threads it through
- [x] `GET/PUT/DELETE /api/profile/gemini-key` storing the envelope verbatim
- [x] `GEMINI_API_KEY` removed from `deploy.yml` (it existed nowhere else)
- [x] `ProfileController` registered in guard coverage
- [x] Tests: create spends no quota; regenerate forwards the CALLER's key; envelope
      round-trips byte-identically; a raw key is rejected

**Acceptance:** backend build clean, full suite green, no `GEMINI_API_KEY` read
anywhere in `src/`. *Met: 244 tests, 27 suites.*

### Task A2 — Browser-side crypto (DONE)

- [x] `key-envelope.ts`: PBKDF2-SHA256 (310k iters) → AES-GCM 256
- [x] Envelope is versioned JSON `{ v, salt, iv, ct }`, base64url
- [x] Wrong passphrase surfaces as a clean failure, not a crash
- [x] Unit tests: round trip, wrong passphrase, tampered ciphertext, version guard

**Acceptance:** encrypt→decrypt returns the original key; a wrong passphrase never
returns plaintext. *Met: 13 tests, including one asserting the envelope never
contains the key.*

### Task A3 — Profile page (DONE)

- [x] Route `/profile`, reached from the header name; signed-out state handled
- [x] Gemini section: set / replace / delete, showing `updatedAt` for staleness
- [x] Never renders the key itself — only whether one is stored
- [x] i18n (en + da), 9 component tests

**Acceptance:** a user can store, replace and remove a key; the plaintext key is
never displayed after saving. *Met — a test asserts the PUT body cannot contain
the key, and that the component's fields are cleared once sealed.*

### Task A4 — Generation flow (DONE)

- [x] `recipe.service.regenerateImages(id, apiKey)`
- [x] `GeminiKeyDialogComponent`: unlock the saved key with a passphrase, OR paste
      a key for one use without saving; falls straight through to pasting when
      nothing is stored, or when the key state cannot be read
- [x] Recipe detail asks for a key before generating — there is no shared fallback
- [x] i18n (en + da), 9 dialog tests

**Acceptance:** generation works from a saved key and from a one-off key; the
one-off path stores nothing. *Met — a test asserts no PUT is issued on the
paste path.*

**Phase A gates:** backend 244 tests / 27 suites, frontend 327 tests / 41 suites,
zero build warnings, i18n CLEAN.

---

## Phase B — Manual image upload

What makes "no shared key" liveable for a cook with no Gemini account.

### Task B1 — Backend upload (DONE)

- [x] `POST /api/recipes/:id/image` multipart, author-scoped and contribution-gated
- [x] 8 MB cap; writes beside generated images; updates `imageUrl`
- [x] Rejects by **magic bytes**, not the declared type or extension — a `.png`
      extension on HTML is the classic route to stored XSS served from our own
      origin. RIFF is checked for the `WEBP` subtype so .wav/.avi cannot pass.
- [x] Multer keeps the file in memory, so a rejected upload never reaches disk
- [x] Registered in guard coverage, with an explicit assertion that upload is
      contribution-gated; 12 tests

**Acceptance:** an author can replace a recipe's hero image by upload; a
non-contributor gets 403; a non-image is refused. *Met: 256 backend tests.*

### Task B2 — Frontend upload (DONE)

- [x] Upload control on recipe detail beside generation, a hidden file input
      behind a styled label
- [x] Client-side type and size checks before the request, so an oversized photo
      is refused without being uploaded first
- [x] Filename carries a timestamp, so caches cannot serve the previous picture
- [x] i18n (en + da)

---

## Phase C — Per-user MCP keys

Today one shared `RECIPE_MANAGER_MCP_TOKEN` means every MCP write is attributed to
the owner and cannot be revoked per person.

### Task C1 — Backend keys (DONE)

- [x] `McpApiKey` model + migration `20260806100000_mcp_api_keys`
- [x] `rmk_`-prefixed token from 32 CSPRNG bytes, returned **once**; only a
      SHA-256 hash is stored. SHA-256 rather than a slow KDF is deliberate: this
      is not a password, so there is no dictionary to attack and a KDF would buy
      only latency on every MCP call.
- [x] `SsoAuthGuard` accepts `X-MCP-Key`, resolves it to its owner, and is checked
      **before** the shared service token so a personal key wins
- [x] `User.canContribute` caches the grant, because an MCP caller has no JWT to
      read `apps` from. Known consequence, written into the migration: a revoked
      grant keeps working over MCP until that person next signs in via the browser
- [x] Shared service token still accepted, so an existing Desktop config keeps
      working
- [x] Revoke marks rather than deletes; `lastUsedAt` recorded fire-and-forget
- [x] 20 service tests + 4 guard tests

**Acceptance:** two users' MCP keys produce recipes attributed to each of them; a
revoked key is refused. *Met.*

**Caught while doing this:** `sso-auth.guard.spec.ts` was constructing the guard
with one argument after it gained two. `nest build` excludes specs, so only
`tsc --noEmit` found it — the same class of hole as the `Difficulty.easy` slip in
Phase A. `npx tsc --noEmit -p tsconfig.json` is now part of the routine.

### Task C2 — Profile surface (DONE)

- [x] Profile page section: create with a label, list with prefix, revoke
- [x] Token shown once with a copy-now warning and a dismiss control
- [x] Link to the guide
- [x] i18n (en + da), 3 tests

### Task C3 — MCP server (DONE)

- [x] `lib/caller-context.js`: AsyncLocalStorage carrying the caller's key, so no
      tool signature has to know how the caller authenticated
- [x] `api-client.js` sends `X-MCP-Key` when a personal key is present, falling
      back to the service token
- [x] `auth.js` accepts a personal key on shape alone — this process holds no key
      material, and the backend is the only thing that can say whether a key is
      real, whose it is, or revoked
- [x] 4 new tests (30 total, passing)

---

## Phase D — Front-page MCP guide

### Task D1 — Guide content (DONE)

- [x] `/mcp-guide` page: three steps, the `mcp-remote` config snippet, the endpoint
- [x] No shared secret in the copy — step 1 sends the reader to their own profile
- [x] Explains why the header is written without a space (Windows `npx.cmd`
      re-parses arguments and silently drops a split header)
- [x] Says plainly that adding to the shared collection needs the account grant,
      while reading and one's own kitchen do not
- [x] Linked from the foot of the front page; i18n (en + da)

**Acceptance:** a new cook can follow it end to end without the owner acting.
*Met — verified earlier that the endpoint is live and gated (401, not 404).*

**Phase C+D gates:** backend 274 tests / 29 suites, frontend 330 tests / 41 suites,
mcp-server 30 tests, zero build warnings, i18n CLEAN, `tsc --noEmit` clean.

---

## Not in scope, tracked elsewhere

- **Backend lint formatting.** `npx eslint "src/**/*.ts"` reports 318 errors + 1
  warning across 46 files, 309 of them `prettier/prettier`, because
  `backend/.prettierrc` sets no `printWidth` (so Prettier defaults to 80) while
  the code was written wider. `npm run lint` passes only because it includes
  `--fix`. Agreed 2026-08-05 to fix in a dedicated session.
- **Probe account cleanup:** `recipe-mgr-probe-20260806@example.com`
  (`04f1e04b-d428-4402-b4cf-4e1f9c60e02e`), created to learn the registration
  contract.
- **Delete the `GEMINI_API_KEY` repo secret** once Phase A ships.
- **Regenerate the tasktracker MCP API key** — the current one is rejected
  server-side, which is why this file exists.
