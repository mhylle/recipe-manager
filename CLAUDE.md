# Project Rules

## Zero Errors/Warnings Policy
There is no such thing as "preexisting" errors or warnings. Every phase must be completed with **zero errors and zero warnings**. Never skip or dismiss any error/warning by attributing it to prior state — fix everything.

**"Any error" means any error in the repo, not just in the files you touched.** Verification is repo-wide, never scoped to your own diff: run the full test suite, the full lint, and the full build, and read the whole output. Scoping the check to the files you edited is exactly how a change that breaks a test or a type somewhere else slips through — the file you never opened is the one that fails, and a diff-scoped check reports success. "It was already failing" is not a finding you get to stop at; either fix it or get an explicit decision to defer it.

If a fix genuinely does not belong in the current change — a repo-wide reformat landing in the middle of a feature, say — do not silently leave it. Say so, quantify it, and record it as a tasktracker task before moving on. Deferring is a decision that needs an owner and a ticket, never a comment in this file.

## Backlog lives in tasktracker, not GitHub

**tasktracker is the backlog. GitHub issues are an inbox.** Issues are where people
outside the project report things; they are reports, not agreed work. The owner
triages which ones become tasks — do not start implementing a GitHub issue on the
assumption that filing it meant approval, and do not file internal findings as
GitHub issues.

Anything actually worked on gets a tasktracker task, set active while you work it
so the time is recorded, and closed with a note saying what shipped and where.
Findings you hit on the way but do not fix belong in tasktracker too, as defects
or learnings — a comment in a PR body is not a backlog.

## Prove the bug before fixing it, and prove the fix on real data

Every non-trivial defect this project has had was cheaper to find by reproducing
it than by reasoning about it, and several were the opposite of the initial
diagnosis.

- **Reproduce first, against something real.** The pantry-sharing bug looked like
  a backend lookup failure; a local run of the real backend against a real
  Postgres showed the API returning 201 correctly, which is what redirected the
  search to the frontend where the bug actually was.
- **Then verify on production with a query you can show.** `pantryId: 0, NULL: 49`
  is what turned "private recipes seem broken" into a known scope in seconds.
  That number was available before the bug was reported.
- **Shell in CI is testable — extract it.** Pulling the deploy script out of the
  workflow YAML and running just the section under test caught two things reading
  could not: that removing one tag of a multi-tagged image merely untags it, and
  whether the construct survives `set -e`. Do that instead of deploying to find out.

## Test the transition, not just the endpoints

Both ends can be correct while the path between them is broken, and that is where
this project's regressions have lived.

- Testing "create it with X" and "the rule handles X" does **not** cover "change an
  existing thing to X". The private-recipes regression sat exactly there.
- A test that calls a component method proves the method works and says nothing
  about whether the template can reach it. For a form, dispatch a real `submit`
  event; the kitchen-sharing form never submitted for as long as it existed and
  every test passed.
- When asserting against a mock, assert on the argument the real collaborator
  **reads**. Asserting on what you just passed makes the test agree with the bug.
- A test written in the same breath as the fix inherits the fix's assumptions.
  Derive the assertion from the collaborator's contract, not from the call you
  just wrote.

## Failure modes with no error need a check, not vigilance

When something can break with no compile error, no warning and no failing test,
add a mechanical check and prove it fails on the real bug.

- `npm run check` in `frontend/` runs the i18n sweep and `check-form-submit.mjs`
  (rejects an `(ngSubmit)` form with no `[formGroup]` and no FormsModule — see
  the note above). Both were written after a silent failure got to production.
- Undefined CSS custom properties are the same shape: `var(--does-not-exist)`
  resolves to nothing, so a dialog renders invisible. Check a token exists in
  `styles.scss` before using it; there is no bare `--surface-container`, only
  `-low`, `-lowest` and `-high`.

## Read the API before calling it

Two near-misses this session came from assuming a contract instead of reading it:
a GitHub Action input that does not exist (`ignore-versions-included-in-tags`),
and an endpoint assumed to reject duplicates that actually answers 201 by design.
For anything destructive or outward-facing, read the definition first — `gh api
repos/OWNER/REPO/contents/action.yml`, the DTO, the source. Never establish an
ordering assumption from a default when the operation deletes: sort explicitly.

## Architecture
- **Backend**: NestJS 11 + Prisma 7 + PostgreSQL
- **Frontend**: Angular 21 (standalone components, signals)
- **Database**: `recipe_manager_db`, user `recipe_manager_user`
- **Deployment**: Docker containers on mhylle.com infrastructure
- **URLs**: Frontend at `/recipe-manager/`, API at `/api/recipe-manager/api/`
- **Ports**: Frontend `3007:80`, Backend `8006:3000`

## Development Commands
```bash
# Backend
cd backend
npm run start:dev          # Dev server (port 3000)
npm run build              # Production build
npm test                   # Jest tests
npx prisma migrate dev     # Create new migration
npx prisma studio          # Visual DB browser

# Frontend
cd frontend
npm start                  # Dev server (port 4200, proxy to backend)
npm run build              # Production build
npm test                   # Vitest tests

# Docker (local dev)
docker compose up -d       # Start all services with local postgres
docker compose down        # Stop all services
```

## Database
- Prisma 7 with `prisma.config.ts` for datasource config
- `DATABASE_URL` env var required (set in `.env` for local dev)
- Migrations auto-run on container startup via `prisma migrate deploy` — so a
  failing migration stops the backend rather than serving a stale schema
- Local dev shares the `cassiopeia-postgres-dev` container on port 5433; there is
  no separate recipe-manager postgres. `recipe_manager_db` and
  `recipe_manager_user` live inside it.

### Adding a column is a decision about existing rows

`ADD COLUMN` gives every existing row NULL. If any read path branches on that
column, NULL is now a behaviour — and usually not one anyone chose. Write the
backfill in the same migration, or write down why NULL is correct for rows that
already exist. `Recipe.pantryId` shipped without one and silently narrowed every
private recipe in the library to its author alone (#65).

## Frontend checks
```bash
cd frontend
npm run check              # i18n sweep + (ngSubmit) form-owner check
npm run check:i18n         # no hardcoded user-facing English in templates
npm run check:forms        # every (ngSubmit) form has a directive that can raise it
```

## Deploys and images
- Push to `main` builds three images, deploys over SSH, and verifies before
  finishing. `prune-registry` runs after, and is `continue-on-error` on purpose —
  the app is live by then, so housekeeping must not fail a good deploy.
- Retention is **current + previous**, on the server and in GHCR. Anything older
  is rebuildable from git.
- `docker image prune -f` alone reclaims nothing here: every build keeps a version
  tag, so it is never dangling. `.github/workflows/prune-registry.yml` is a manual
  broom for a backlog only; the per-deploy prune handles steady state.
