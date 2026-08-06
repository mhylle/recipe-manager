# Project Rules

## Zero Errors/Warnings Policy
There is no such thing as "preexisting" errors or warnings. Every phase must be completed with **zero errors and zero warnings**. Never skip or dismiss any error/warning by attributing it to prior state — fix everything.

**"Any error" means any error in the repo, not just in the files you touched.** Verification is repo-wide, never scoped to your own diff: run the full test suite, the full lint, and the full build, and read the whole output. Scoping the check to the files you edited is exactly how a change that breaks a test or a type somewhere else slips through — the file you never opened is the one that fails, and a diff-scoped check reports success. "It was already failing" is not a finding you get to stop at; either fix it or get an explicit decision to defer it.

If a fix genuinely does not belong in the current change — a repo-wide reformat landing in the middle of a feature, say — do not silently leave it. Say so, quantify it, and record it as a tasktracker task before moving on. Deferring is a decision that needs an owner and a ticket, never a comment in this file.

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
- Migrations auto-run on container startup via `prisma migrate deploy`
