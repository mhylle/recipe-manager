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

### Task C1 — Backend keys

- [ ] `McpApiKey` model: userId, token **hash**, label, createdAt, lastUsedAt, revokedAt
- [ ] Token shown **once** at creation, stored only as a hash
- [ ] `SsoAuthGuard` accepts an MCP key and resolves it to its owner, so writes
      attribute correctly and the contribution gate applies per person
- [ ] Keep the service token working, or migrate the MCP server off it
- [ ] Migration; guard coverage; tests including revocation taking effect

**Acceptance:** two users' MCP keys produce recipes attributed to each of them; a
revoked key is refused.

### Task C2 — Profile surface

- [ ] Profile page section: create a key, see label/created/last-used, revoke
- [ ] Copy-once affordance and a link to the guide
- [ ] i18n (en + da), tests

---

## Phase D — Front-page MCP guide

### Task D1 — Guide content

- [ ] A guide page reachable from the front page, explaining `mcp-remote` wiring
      against `https://mhylle.com/mcp/recipe-manager` with the reader's OWN key
- [ ] No shared secret in the copy — it points at the profile page instead
- [ ] Explains the `X-MCP-Token` vs bearer nuance already documented in
      `mcp-server/README.md` (a space in the header breaks Windows `npx.cmd`)
- [ ] i18n (en + da)

**Acceptance:** a new cook can follow it end to end without the owner acting.

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
