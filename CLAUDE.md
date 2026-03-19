# Project Rules

## Zero Errors/Warnings Policy
There is no such thing as "preexisting" errors or warnings. Every phase must be completed with **zero errors and zero warnings**. Never skip or dismiss any error/warning by attributing it to prior state — fix everything.

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
