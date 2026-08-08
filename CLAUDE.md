# Project Rules

Keep this file **under 200 lines**. It is the rules, not the reasons — put the
incident, the reasoning and the architecture decision in tasktracker and leave one
actionable line here. If a section is retelling a story, it belongs there instead.

## Zero Errors/Warnings Policy
There is no such thing as "preexisting" errors or warnings. Every phase must be completed with **zero errors and zero warnings**. Never skip or dismiss any error/warning by attributing it to prior state — fix everything.

**"Any error" means any error in the repo, not just in the files you touched.** Verification is repo-wide, never scoped to your own diff: run the full test suite, the full lint, and the full build, and read the whole output. Scoping the check to the files you edited is exactly how a change that breaks a test or a type somewhere else slips through — the file you never opened is the one that fails, and a diff-scoped check reports success. "It was already failing" is not a finding you get to stop at; either fix it or get an explicit decision to defer it.

If a fix genuinely does not belong in the current change — a repo-wide reformat landing in the middle of a feature, say — do not silently leave it. Say so, quantify it, and record it as a tasktracker task before moving on. Deferring is a decision that needs an owner and a ticket, never a comment in this file.

## Backlog lives in tasktracker, not GitHub

**tasktracker is the backlog. GitHub issues are an inbox** — reports from outside
the project, not agreed work. The owner triages which become tasks; filing one is
not approval to implement it, and internal findings do not go there.

Anything worked on gets a tasktracker task, set active while you work it so time
is recorded, closed with a note on what shipped and where. Findings you hit but do
not fix go there too, as defects or learnings.

## Verify against reality, not reasoning

- **Reproduce a bug before fixing it.** Twice this project's obvious diagnosis was
  the wrong layer entirely.
- **Confirm the fix on production data with a query you can show.** One `curl`
  turned "private recipes seem broken" into a counted scope.
- **CI shell is testable** — extract the script from the workflow YAML and run the
  section under test rather than deploying to find out.

## Test the transition, not just the endpoints

- "Create with X" + "the rule handles X" does **not** cover "change an existing
  thing to X". That gap is where the regressions have been.
- Calling a component method says nothing about whether the template can reach it.
  For a form, dispatch a real `submit` event.
- Assert on the argument the collaborator **reads**, not the one you passed —
  otherwise the test agrees with the bug. Derive it from the collaborator's
  contract, not from the call you just wrote.

## Silent failure modes need a mechanical check

No compile error, no warning, no failing test means add a check and prove it fails
on the real bug. Existing ones: `npm run check` (i18n sweep + `(ngSubmit)` needs
`[formGroup]` or FormsModule). Same shape: `var(--missing-token)` resolves to
nothing and renders invisible — confirm a token exists in `styles.scss` first.

## Read the API before calling it

Read the DTO, source, or `action.yml` rather than assuming an input or status code,
especially for anything destructive or outward-facing. Never take an ordering from
a default when the operation deletes — sort explicitly.

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
npm run check              # i18n sweep + (ngSubmit) form-owner check

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

- **`ADD COLUMN` is a decision about existing rows.** They all get NULL, so if any
  read branches on that column, NULL is now a behaviour. Backfill in the same
  migration, or record why NULL is right for rows that already exist.

## Deploys and images
- Push to `main` builds three images, deploys over SSH, and verifies before
  finishing. `prune-registry` runs after, and is `continue-on-error` on purpose —
  the app is live by then, so housekeeping must not fail a good deploy.
- Retention is **current + previous**, on the server and in GHCR. Anything older
  is rebuildable from git.
- `docker image prune -f` alone reclaims nothing here: every build keeps a version
  tag, so it is never dangling. `.github/workflows/prune-registry.yml` is a manual
  broom for a backlog only; the per-deploy prune handles steady state.
