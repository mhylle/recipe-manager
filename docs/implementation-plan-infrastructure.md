# Implementation Plan: Recipe Manager Infrastructure Integration

## Overview

Migrate the recipe-manager from file-per-record JSON storage to Prisma + PostgreSQL, containerize both frontend and backend with Docker, and integrate into the mhylle.com infrastructure alongside child-heights, app2, scalper, and drop-n-drive.

**Target URLs:**
- Frontend: `https://mhylle.com/recipe-manager/`
- Backend API: `https://mhylle.com/api/recipe-manager/`

**Assigned ports and names:**
- Frontend container: `recipe-manager-frontend` (3007:80)
- Backend container: `recipe-manager-backend` (8006:3000)
- Database: `recipe_manager_db`, user: `recipe_manager_user`
- GHCR images: `ghcr.io/mhylle/recipe-manager-frontend`, `ghcr.io/mhylle/recipe-manager-backend`

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Prisma + PostgreSQL (Local) | NOT STARTED | |
| Phase 2: Docker Setup | NOT STARTED | |
| Phase 3: Infrastructure Integration | NOT STARTED | |

## Current State

The app is fully functional (8 phases complete) using `FileStorageService` for persistence (one JSON file per record in `data/` subdirectories). There are 4 repositories (`RecipeRepository`, `PantryRepository`, `MealPlanRepository`, `ShoppingListRepository`) and 1 file-based service (`StaplesService`) that all need migration. The frontend uses hardcoded `/api/...` paths (works via dev proxy to `localhost:3000`). There is no Docker configuration, no environment file system, and no CI/CD pipeline.

---

## Phase 1: Add Prisma + PostgreSQL to Backend (Local)

**Objective**: Replace all file-based persistence with Prisma ORM backed by PostgreSQL. All existing API contracts and behavior remain identical; only the storage layer changes.

**Verification Approach**: All 81 existing backend tests continue to pass. Manual testing confirms CRUD operations work against a local PostgreSQL instance. Frontend behavior is unchanged when running against the migrated backend.

### Step 1.1: Install Prisma Dependencies

**Tasks:**

- [ ] Install production dependencies: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
- [ ] Install dev dependencies: `prisma`
- [ ] Add `dotenv/config` import at top of `main.ts` (before NestJS bootstrap)
- [ ] Add `prisma/` directory to `.gitignore` exclusion for `migrations/` output, but track `schema.prisma`
- [ ] Create `.env` file (gitignored) with `DATABASE_URL=postgresql://recipe_manager_user:local_dev_password@localhost:5432/recipe_manager_db`
- [ ] Create `.env.example` with placeholder: `DATABASE_URL=postgresql://user:password@localhost:5432/recipe_manager_db`

**Why `@prisma/adapter-pg` + `pg`**: This matches the child-heights pattern and gives connection pooling via `pg.Pool`. Prisma 7 requires a driver adapter for PostgreSQL.

### Step 1.2: Create Prisma Schema

**Tasks:**

- [ ] Create `backend/prisma/schema.prisma` with all models

The schema must normalize the currently embedded arrays (ingredients, entries, items) into proper relational tables with foreign keys. The schema maps TypeScript enums to Prisma enums.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// --- Enums ---

enum Unit {
  g
  kg
  ml
  l
  tsp
  tbsp
  piece
  pinch
}

enum Difficulty {
  easy
  medium
  hard
}

enum MealType {
  breakfast
  lunch
  dinner
  snack
}

enum DayOfWeek {
  monday
  tuesday
  wednesday
  thursday
  friday
  saturday
  sunday
}

enum PantryCategory {
  dairy
  meat
  produce
  grains
  spices
  condiments
  baking
  frozen
  canned
  beverages
  snacks
  other
}

// --- Models ---

model Recipe {
  id           String             @id @default(cuid())
  name         String
  description  String
  servings     Int
  instructions String[]
  prepTime     Int                @map("prep_time")
  cookTime     Int                @map("cook_time")
  difficulty   Difficulty
  tags         String[]
  imageUrl     String?            @map("image_url")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")
  ingredients  RecipeIngredient[]
  mealPlanEntries MealPlanEntry[]

  @@map("recipes")
}

model RecipeIngredient {
  id             String         @id @default(cuid())
  recipeId       String         @map("recipe_id")
  recipe         Recipe         @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  name           String
  quantity       Decimal        @db.Decimal(10, 2)
  unit           Unit
  pantryCategory PantryCategory @map("pantry_category")

  @@index([recipeId])
  @@map("recipe_ingredients")
}

model PantryItem {
  id          String         @id @default(cuid())
  name        String
  quantity    Decimal        @db.Decimal(10, 2)
  unit        Unit
  category    PantryCategory
  barcode     String?
  expiryDate  DateTime?      @map("expiry_date")
  addedDate   DateTime       @default(now()) @map("added_date")
  lastUpdated DateTime       @updatedAt @map("last_updated")

  @@map("pantry_items")
}

model MealPlan {
  id            String          @id @default(cuid())
  weekStartDate String          @unique @map("week_start_date")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  entries       MealPlanEntry[]
  shoppingLists ShoppingList[]

  @@map("meal_plans")
}

model MealPlanEntry {
  id         String   @id @default(cuid())
  mealPlanId String   @map("meal_plan_id")
  mealPlan   MealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  day        DayOfWeek
  meal       MealType
  recipeId   String   @map("recipe_id")
  recipe     Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  servings   Int

  @@index([mealPlanId])
  @@index([recipeId])
  @@map("meal_plan_entries")
}

model ShoppingList {
  id            String             @id @default(cuid())
  mealPlanId    String             @map("meal_plan_id")
  mealPlan      MealPlan           @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  generatedDate DateTime           @default(now()) @map("generated_date")
  items         ShoppingListItem[]

  @@index([mealPlanId])
  @@map("shopping_lists")
}

model ShoppingListItem {
  id             String       @id @default(cuid())
  shoppingListId String       @map("shopping_list_id")
  shoppingList   ShoppingList @relation(fields: [shoppingListId], references: [id], onDelete: Cascade)
  name           String
  quantity       Decimal      @db.Decimal(10, 2)
  unit           Unit
  checked        Boolean      @default(false)

  @@index([shoppingListId])
  @@map("shopping_list_items")
}

model StaplesConfig {
  id    String   @id @default("singleton")
  items String[]

  @@map("staples_config")
}
```

**Key design decisions:**
- `RecipeIngredient` is a separate table (was an embedded array) with `onDelete: Cascade` from `Recipe`
- `MealPlanEntry` is a separate table (was an embedded array) with its own `id` field, replacing the fragile index-based references
- `ShoppingListItem` is a separate table (was an embedded array)
- `StaplesConfig` uses a singleton row pattern (fixed `id = "singleton"`) since there is only one config
- `weekStartDate` on `MealPlan` is `@unique` to enforce one plan per week
- `Decimal(10, 2)` for quantities to avoid floating-point issues
- All tables use `@@map()` for snake_case table names and `@map()` for snake_case column names
- `@updatedAt` replaces the manual `lastUpdated` timestamp logic

### Step 1.3: Create PrismaService (NestJS Injectable)

**Tasks:**

- [ ] Create `backend/src/prisma/prisma.service.ts` following the child-heights pattern:
  - Extends `PrismaClient`
  - Implements `OnModuleInit` and `OnModuleDestroy`
  - Uses `@prisma/adapter-pg` with `pg.Pool` for connection pooling
  - Reads `DATABASE_URL` from environment
  - Calls `$connect()` on init, `$disconnect()` + `pool.end()` on destroy
- [ ] Create `backend/src/prisma/prisma.module.ts`:
  - `@Global()` module so PrismaService is available everywhere without importing
  - Exports `PrismaService`
- [ ] Import `PrismaModule` in `AppModule` (add to `imports` array)

### Step 1.4: Migrate Repositories from FileStorageService to Prisma

Each repository currently wraps `FileStorageService<T>`. They must be rewritten to inject `PrismaService` and use Prisma Client queries instead. The service layer above each repository should require minimal changes since the repository API (create, findAll, findById, update, delete) stays the same.

**Important**: The interfaces in `shared/interfaces/` define the API response shape. The Prisma models may return slightly different shapes (e.g., `Decimal` instead of `number`, nested relations). Each repository must map Prisma results back to the existing interface shape to avoid breaking the API contract.

#### 1.4a: RecipeRepository

- [ ] Rewrite `recipe.repository.ts`:
  - Inject `PrismaService`
  - `create()`: Use `prisma.recipe.create({ data: { ...dto, ingredients: { create: dto.ingredients } } })` with nested ingredient creation
  - `findAll()`: Use `prisma.recipe.findMany({ include: { ingredients: true } })`
  - `findById()`: Use `prisma.recipe.findUniqueOrThrow({ where: { id }, include: { ingredients: true } })`, catch Prisma `NotFoundError` and throw NestJS `NotFoundException`
  - `update()`: Use `prisma.recipe.update()` with transaction to delete old ingredients and create new ones if ingredients array is provided
  - `delete()`: Use `prisma.recipe.delete({ where: { id } })` (cascade deletes ingredients)
  - Map `Decimal` fields back to `number` in returned objects
  - Map `ingredients` to strip the `id`, `recipeId` fields so the API shape matches the existing `RecipeIngredient` interface

#### 1.4b: PantryRepository

- [ ] Rewrite `pantry.repository.ts`:
  - Inject `PrismaService`
  - `create()`: Use `prisma.pantryItem.create({ data })`
  - `findAll()`: Use `prisma.pantryItem.findMany()`
  - `findById()`: Use `prisma.pantryItem.findUniqueOrThrow()` with `NotFoundException` mapping
  - `update()`: Use `prisma.pantryItem.update()`
  - `delete()`: Use `prisma.pantryItem.delete()`
  - Map `Decimal` quantity to `number`, `DateTime` expiryDate to ISO string

#### 1.4c: MealPlanRepository

- [ ] Rewrite `meal-plan.repository.ts`:
  - Inject `PrismaService`
  - `create()`: Use `prisma.mealPlan.create({ data: { weekStartDate, entries: { create: entries } } })`
  - `findAll()`: Use `prisma.mealPlan.findMany({ include: { entries: true } })`
  - `findById()`: Use `prisma.mealPlan.findUniqueOrThrow({ include: { entries: true } })`
  - `update()`: Handle entry updates via transaction (delete all entries, recreate)
  - `delete()`: Use `prisma.mealPlan.delete()` (cascade deletes entries)
  - **Breaking change to address**: The current API uses entry array indices for `removeEntry(mealPlanId, entryIndex)` and `updateEntryServings(mealPlanId, entryIndex, servings)`. With Prisma, entries have their own IDs. Two options:
    - **Option A (recommended)**: Change the API to use entry IDs instead of indices. Update frontend accordingly. This is more robust.
    - **Option B (backward-compatible)**: Keep index-based API, fetch entries ordered by creation date, and resolve index to entry ID in the service layer.
  - Whichever option is chosen, the `MealPlanEntry` interface should gain an `id` field

#### 1.4d: ShoppingListRepository

- [ ] Rewrite `shopping-list.repository.ts`:
  - Inject `PrismaService`
  - `create()`: Use `prisma.shoppingList.create({ data: { mealPlanId, generatedDate, items: { create: items } } })`
  - `findAll()`: Use `prisma.shoppingList.findMany({ include: { items: true } })`
  - `findById()`: Use `prisma.shoppingList.findUniqueOrThrow({ include: { items: true } })`
  - `update()`: Handle item toggle via `prisma.shoppingListItem.update()` by item ID
  - Map Decimal quantities to numbers

#### 1.4e: StaplesService

- [ ] Rewrite `staples.service.ts` to use Prisma instead of direct file I/O:
  - `getStaples()`: `prisma.staplesConfig.findUnique({ where: { id: 'singleton' } })`, return `{ items: [] }` if not found
  - `updateStaples()`: `prisma.staplesConfig.upsert({ where: { id: 'singleton' }, create: { items }, update: { items } })`
  - `isStaple()`: Same logic, delegates to `getStaples()`

### Step 1.5: Update Module Imports

- [ ] Remove `StorageModule` from `AppModule` imports (no longer needed)
- [ ] Verify `PrismaModule` is imported as `@Global()` so all repositories can inject `PrismaService`
- [ ] Remove or deprecate `storage/file-storage.service.ts` and `storage/storage.module.ts` (can keep for reference but remove from imports)

### Step 1.6: Run Migrations Locally

**Tasks:**

- [ ] Start a local PostgreSQL instance (e.g., `docker run -e POSTGRES_USER=recipe_manager_user -e POSTGRES_PASSWORD=local_dev_password -e POSTGRES_DB=recipe_manager_db -p 5432:5432 postgres:15`)
- [ ] Run `npx prisma migrate dev --name init` to create the initial migration
- [ ] Verify migration SQL files are created in `prisma/migrations/`
- [ ] Run `npx prisma generate` to generate the Prisma Client

### Step 1.7: Update Interface Types

- [ ] Add `id` field to `MealPlanEntry` interface (was previously index-based)
- [ ] Add `id` field to `ShoppingListItem` interface (for toggle by ID)
- [ ] Update frontend models to match (`meal-plan.model.ts`, `shopping-list.model.ts`)
- [ ] Update `MealPlanService` and `ShoppingListService` to use entry/item IDs instead of array indices
- [ ] Update frontend `meal-plan.service.ts` and `shopping-list.service.ts` to pass IDs
- [ ] Update meal-plan-grid and shopping-list-view components to work with IDs

### Step 1.8: Test Everything

- [ ] `cd backend && npm test` -- all 81 tests pass (update test mocks to use PrismaService instead of FileStorageService)
- [ ] `cd frontend && npm test` -- all 71 tests pass
- [ ] `cd backend && npm run build` succeeds with zero errors and zero warnings
- [ ] `cd frontend && npm run build` succeeds with zero errors and zero warnings
- [ ] Manual end-to-end test: create recipe with ingredients, add pantry items, create meal plan, generate shopping list, toggle items, confirm cooked

**Exit Conditions:**
- Zero errors, zero warnings in both `npm run build` commands
- All existing tests pass (update mocks as needed)
- CRUD operations work against local PostgreSQL
- No references to `FileStorageService` remain in production code (only in deprecated/removed files)
- `data/` directory is no longer needed at runtime

---

## Phase 2: Docker Setup

**Objective**: Create Docker containers for both frontend and backend, with a local docker-compose for development and production overrides for deployment to mhylle.com infrastructure.

**Verification Approach**: `docker-compose up` starts both containers locally. Frontend serves the Angular app. Backend connects to PostgreSQL and responds to API requests. Health checks pass.

### Step 2.1: Backend Dockerfile

**Tasks:**

- [ ] Create `backend/Dockerfile` (multi-stage build, modeled on child-heights):

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY --chown=nestjs:nodejs backend/package*.json ./
RUN npm ci --only=production

COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nestjs:nodejs backend/prisma ./prisma

USER nestjs

EXPOSE 3000

ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD sh -c "npx prisma migrate deploy && node dist/main"
```

**Key details:**
- Build context is the repo root (so `COPY backend/...` works), matching the child-heights pattern
- `npx prisma generate` runs in the build stage to generate the client
- `npx prisma migrate deploy` runs on container startup (before `node dist/main`) to apply any pending migrations
- Non-root user `nestjs` for security
- Health check hits the NestJS health endpoint
- Note: If there is no `prisma.config.ts` file, remove the COPY for it (child-heights has one, recipe-manager may not need it)

- [ ] Add a health check endpoint to the backend:
  - Add `GET /api/health` returning `{ status: 'ok' }` in `AppController`
  - Or use the existing root route `GET /api` if it returns a suitable response

### Step 2.2: Frontend Dockerfile

**Tasks:**

- [ ] Create `frontend/Dockerfile` (multi-stage: build + nginx serve):

```dockerfile
# Build stage
FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

ARG BASE_HREF=/recipe-manager/
RUN npm run build -- --base-href=${BASE_HREF}

# Production stage
FROM nginx:alpine

RUN apk add --no-cache curl

COPY --from=build /app/dist/frontend/browser/ /usr/share/nginx/html/

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /var/cache/nginx/client_temp && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Key details:**
- The Angular 21 build output goes to `dist/frontend/browser/` (the project name is `frontend` based on `angular.json`)
- `BASE_HREF` build arg allows overriding at build time (defaults to `/recipe-manager/`)
- Build context is repo root

### Step 2.3: Frontend nginx.conf

**Tasks:**

- [ ] Create `frontend/nginx.conf` (identical pattern to child-heights):

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    location ~ /\. {
        deny all;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss image/svg+xml;
}
```

**Details:**
- SPA routing: all paths fall back to `index.html`
- Static assets get 1-year cache with `immutable` (Angular uses content hashing)
- `/health` endpoint for Docker health checks
- Dotfiles denied
- gzip enabled

### Step 2.4: docker-compose.yml (Local Development)

**Tasks:**

- [ ] Create `docker-compose.yml` at the repository root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: recipe_manager_user
      POSTGRES_PASSWORD: local_dev_password
      POSTGRES_DB: recipe_manager_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U recipe_manager_user -d recipe_manager_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://recipe_manager_user:local_dev_password@postgres:5432/recipe_manager_db
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        BASE_HREF: /recipe-manager/
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

### Step 2.5: docker-compose.prod.yml (Production Overrides)

**Tasks:**

- [ ] Create `docker-compose.prod.yml` for reference (actual production deployment uses `docker run` commands in the GitHub Actions workflow, but this file documents the production configuration):

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/mhylle/recipe-manager-backend:latest
    container_name: recipe-manager-backend
    restart: unless-stopped
    networks:
      - mhylle_app-network
    ports:
      - "8006:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://recipe_manager_user:${RECIPE_MANAGER_DB_PASSWORD}@mhylle-postgres:5432/recipe_manager_db

  frontend:
    image: ghcr.io/mhylle/recipe-manager-frontend:latest
    container_name: recipe-manager-frontend
    restart: unless-stopped
    networks:
      - mhylle_app-network
    ports:
      - "3007:80"
    environment:
      NODE_ENV: production

networks:
  mhylle_app-network:
    external: true
```

### Step 2.6: Update Frontend for Production API URL

**Tasks:**

- [ ] Create `frontend/src/environments/environment.ts`:
  ```typescript
  export const environment = {
    production: false,
    apiUrl: '/api',
  };
  ```

- [ ] Create `frontend/src/environments/environment.prod.ts`:
  ```typescript
  export const environment = {
    production: true,
    apiUrl: '/api/recipe-manager',
  };
  ```

- [ ] Configure `angular.json` file replacements for production build:
  ```json
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ]
  ```

- [ ] Update all frontend services to use `environment.apiUrl` instead of hardcoded `/api`:
  - `recipe.service.ts`: `baseUrl = \`${environment.apiUrl}/recipes\``
  - `pantry.service.ts`: `baseUrl = \`${environment.apiUrl}/pantry\``
  - `meal-plan.service.ts`: `baseUrl = \`${environment.apiUrl}/meal-plans\``
  - `shopping-list.service.ts`: `baseUrl = \`${environment.apiUrl}/shopping-lists\``
  - `staples.service.ts`: `baseUrl = \`${environment.apiUrl}/staples\``
  - `dashboard.service.ts`: update matching endpoint URL

**Why this works**: In development, the proxy forwards `/api` to `localhost:3000`. In production, nginx strips `/api/recipe-manager/` and forwards to the backend, but the frontend requests `/api/recipe-manager/recipes` etc., which nginx handles correctly.

### Step 2.7: Update Backend CORS for Production

**Tasks:**

- [ ] Update `main.ts` CORS configuration:
  ```typescript
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? 'https://mhylle.com'
      : 'http://localhost:4200',
  });
  ```

### Step 2.8: Verify Docker Setup

- [ ] `docker-compose up --build` starts all three services (postgres, backend, frontend)
- [ ] Backend health check passes: `curl http://localhost:3000/api/health`
- [ ] Frontend health check passes: `curl http://localhost:8080/health`
- [ ] Frontend serves Angular app: `curl http://localhost:8080/` returns HTML
- [ ] API works through frontend (test recipe CRUD via the UI at `http://localhost:8080/recipe-manager/`)

**Exit Conditions:**
- `docker-compose up --build` succeeds with zero errors
- Both containers report healthy
- Full CRUD workflow works through the Docker setup
- Images build in under 5 minutes

---

## Phase 3: Infrastructure Integration

**Objective**: Wire the recipe-manager into the mhylle.com production infrastructure: database provisioning, nginx routing, CI/CD pipeline, and portals dashboard link.

### Step 3.1: Add to init-databases.sql

**File to modify**: `/home/mhylle/projects/mhylle.com/mhylle-infrastructure/scripts/init-databases.sql`

**Tasks:**

- [ ] Add recipe_manager_user creation block (following the existing pattern):

```sql
-- Create recipe_manager user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'recipe_manager_user') THEN
        CREATE USER recipe_manager_user WITH PASSWORD 'rm_secure_pw_2025';
        RAISE NOTICE 'Created recipe_manager_user';
        RAISE NOTICE 'IMPORTANT: Add RECIPE_MANAGER_DB_PASSWORD=rm_secure_pw_2025 to .env file';
    END IF;
END $$;

-- Create recipe_manager_db database
SELECT 'CREATE DATABASE recipe_manager_db OWNER recipe_manager_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'recipe_manager_db')\gexec

-- Grant privileges
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'recipe_manager_db') THEN
        GRANT ALL PRIVILEGES ON DATABASE recipe_manager_db TO recipe_manager_user;
        RAISE NOTICE 'Granted privileges on recipe_manager_db to recipe_manager_user';
    END IF;
END $$;
```

- [ ] Add schema grants section:

```sql
\c recipe_manager_db

GRANT ALL ON SCHEMA public TO recipe_manager_user;

\c postgres
```

- [ ] Update the completion RAISE NOTICE to include `recipe_manager_db` and `recipe_manager_user`
- [ ] Add `RECIPE_MANAGER_DB_PASSWORD=rm_secure_pw_2025` to the server's `.env` file (manual step on the server)

**Note**: Since the PostgreSQL container only runs `init-databases.sql` on first startup, for existing deployments the database and user must be created manually via `psql` on the server:

```bash
docker exec -it mhylle-postgres psql -U mhylle_user -d postgres -c "
  CREATE USER recipe_manager_user WITH PASSWORD 'CHANGE_ME';
  CREATE DATABASE recipe_manager_db OWNER recipe_manager_user;
  GRANT ALL PRIVILEGES ON DATABASE recipe_manager_db TO recipe_manager_user;
"
docker exec -it mhylle-postgres psql -U mhylle_user -d recipe_manager_db -c "
  GRANT ALL ON SCHEMA public TO recipe_manager_user;
"
```

### Step 3.2: Add Nginx Location Blocks

**File to modify**: `/home/mhylle/projects/mhylle.com/mhylle-infrastructure/.github/workflows/deploy-portals.yml`

**Tasks:**

- [ ] Add recipe-manager frontend and backend location blocks to the `apps.conf` heredoc, using the dynamic upstream pattern (same as child-heights, drop-n-drive, scalper):

```nginx
                location /recipe-manager/ {
                    set $rm_frontend recipe-manager-frontend;
                    rewrite ^/recipe-manager/(.*)$ /$1 break;
                    proxy_pass http://$rm_frontend:80;
                    proxy_set_header Host $host;
                    proxy_set_header X-Real-IP $remote_addr;
                    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                    proxy_set_header X-Forwarded-Proto $scheme;
                }

                location /api/recipe-manager/ {
                    set $rm_backend recipe-manager-backend;
                    rewrite ^/api/recipe-manager/(.*)$ /api/$1 break;
                    proxy_pass http://$rm_backend:3000;
                    proxy_http_version 1.1;
                    proxy_set_header Host $host;
                    proxy_set_header X-Real-IP $remote_addr;
                    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                    proxy_set_header X-Forwarded-Proto $scheme;
                }
```

**Important detail about the backend rewrite rule**: The backend uses `app.setGlobalPrefix('api')` so all routes are at `/api/...`. The nginx rewrite `^/api/recipe-manager/(.*)$ /api/$1` strips `/api/recipe-manager/` and replaces it with `/api/` so that:
- `https://mhylle.com/api/recipe-manager/recipes` -> backend receives `/api/recipes`
- `https://mhylle.com/api/recipe-manager/pantry` -> backend receives `/api/pantry`

This preserves the backend's existing route structure without changing the global prefix.

### Step 3.3: Create GitHub Actions Deploy Workflow

**Tasks:**

- [ ] Create `.github/workflows/deploy.yml` in the recipe-manager repository, modeled on child-heights:

```yaml
name: Deploy recipe-manager to mhylle.com

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  FRONTEND_IMAGE_NAME: mhylle/recipe-manager-frontend
  BACKEND_IMAGE_NAME: mhylle/recipe-manager-backend
  APP_NAME: recipe-manager

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 22
    - name: Backend tests
      working-directory: backend
      run: |
        npm ci
        npm run build
        npm test
    - name: Frontend tests
      working-directory: frontend
      run: |
        npm ci
        npm run build
        npm test

  build:
    runs-on: ubuntu-latest
    needs: test
    permissions:
      contents: read
      packages: write
    outputs:
      frontend-image: ${{ steps.meta-frontend.outputs.tags }}
      backend-image: ${{ steps.meta-backend.outputs.tags }}
      version: ${{ steps.version.outputs.version }}
    steps:
    - name: Free disk space
      run: docker system prune -af --volumes || true

    - uses: actions/checkout@v4

    - name: Generate version
      id: version
      run: |
        if [[ ${{ github.ref }} == 'refs/heads/main' ]]; then
          VERSION="v$(date +%Y%m%d)-$(echo ${{ github.sha }} | cut -c1-7)"
        else
          VERSION="pr-${{ github.event.number }}-$(echo ${{ github.sha }} | cut -c1-7)"
        fi
        echo "version=$VERSION" >> $GITHUB_OUTPUT

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - uses: docker/setup-buildx-action@v3

    - name: Frontend metadata
      id: meta-frontend
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=raw,value=latest,enable={{is_default_branch}}
          type=raw,value=${{ steps.version.outputs.version }}

    - name: Build and push frontend
      uses: docker/build-push-action@v6
      with:
        context: .
        file: ./frontend/Dockerfile
        platforms: linux/amd64
        push: true
        tags: ${{ steps.meta-frontend.outputs.tags }}
        labels: ${{ steps.meta-frontend.outputs.labels }}
        build-args: |
          BASE_HREF=/recipe-manager/
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Backend metadata
      id: meta-backend
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=raw,value=latest,enable={{is_default_branch}}
          type=raw,value=${{ steps.version.outputs.version }}

    - name: Build and push backend
      uses: docker/build-push-action@v6
      with:
        context: .
        file: ./backend/Dockerfile
        platforms: linux/amd64
        push: true
        tags: ${{ steps.meta-backend.outputs.tags }}
        labels: ${{ steps.meta-backend.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
    - name: Deploy to server
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        port: ${{ secrets.SERVER_PORT || 22 }}
        script: |
          set -e
          echo "Deploying recipe-manager..."
          cd /home/mhylle/projects/mhylle.com
          source .env

          FRONTEND_FULL=$(echo "${{ needs.build.outputs.frontend-image }}" | head -n1)
          BACKEND_FULL=$(echo "${{ needs.build.outputs.backend-image }}" | head -n1)

          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin

          docker image prune -f || true
          docker container prune -f || true

          docker pull "$FRONTEND_FULL"
          docker pull "$BACKEND_FULL"

          docker stop recipe-manager-frontend recipe-manager-backend 2>/dev/null || true
          docker rm recipe-manager-frontend recipe-manager-backend 2>/dev/null || true

          docker run -d \
            --name recipe-manager-backend \
            --restart unless-stopped \
            --network mhylle_app-network \
            -p 8006:3000 \
            -e NODE_ENV=production \
            -e PORT=3000 \
            -e DATABASE_URL="postgresql://recipe_manager_user:${RECIPE_MANAGER_DB_PASSWORD}@mhylle-postgres:5432/recipe_manager_db" \
            --health-cmd="curl -f http://localhost:3000/api/health || exit 1" \
            --health-interval=30s \
            --health-timeout=10s \
            --health-retries=3 \
            --health-start-period=60s \
            "$BACKEND_FULL"

          docker run -d \
            --name recipe-manager-frontend \
            --restart unless-stopped \
            --network mhylle_app-network \
            -p 3007:80 \
            -e NODE_ENV=production \
            --health-cmd="curl -f http://localhost/health || exit 1" \
            --health-interval=30s \
            --health-timeout=10s \
            --health-retries=3 \
            --health-start-period=30s \
            "$FRONTEND_FULL"

          echo "Waiting for health checks..."
          timeout 120 bash -c 'until [ "$(docker inspect --format="{{.State.Health.Status}}" recipe-manager-backend 2>/dev/null)" = "healthy" ]; do echo "Waiting for backend..."; sleep 5; done' || echo "Backend health timeout"
          timeout 60 bash -c 'until [ "$(docker inspect --format="{{.State.Health.Status}}" recipe-manager-frontend 2>/dev/null)" = "healthy" ]; do echo "Waiting for frontend..."; sleep 5; done' || echo "Frontend health timeout"

          if docker ps | grep -q "recipe-manager-backend.*Up" && docker ps | grep -q "recipe-manager-frontend.*Up"; then
            echo "recipe-manager deployment successful!"
            docker ps --format "table {{.Names}}\t{{.Status}}" | grep recipe-manager
          else
            echo "Deployment failed"
            docker logs recipe-manager-backend --tail=20 2>/dev/null || true
            docker logs recipe-manager-frontend --tail=10 2>/dev/null || true
            exit 1
          fi

    - name: Verify deployment
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        port: ${{ secrets.SERVER_PORT || 22 }}
        script: |
          sleep 15
          curl -f -s https://mhylle.com/recipe-manager/ > /dev/null && echo "Frontend accessible" || echo "Frontend check failed"
          curl -f -s https://mhylle.com/api/recipe-manager/health > /dev/null && echo "API accessible" || echo "API check failed"

  notify:
    runs-on: ubuntu-latest
    needs: [build, deploy]
    if: always()
    steps:
    - name: Status
      run: |
        if [[ "${{ needs.deploy.result }}" == "success" ]]; then
          echo "Deployment successful!"
          echo "App: https://mhylle.com/recipe-manager/"
          echo "API: https://mhylle.com/api/recipe-manager/"
          echo "Version: ${{ needs.build.outputs.version }}"
        elif [[ "${{ needs.deploy.result }}" == "failure" ]]; then
          echo "Deployment failed!"; exit 1
        else
          echo "Deployment skipped (not main branch)"
        fi
```

**Key differences from child-heights:**
- Branch is `main` (not `master`)
- Ports: `8006:3000` (backend), `3007:80` (frontend)
- Container names: `recipe-manager-backend`, `recipe-manager-frontend`
- Database URL uses `RECIPE_MANAGER_DB_PASSWORD` from server `.env`
- Backend health check uses `/api/health` (with the global prefix)
- The `test` job runs both backend and frontend tests before building

### Step 3.4: Add Recipe Manager Card to Portals Dashboard

**File to modify**: `/home/mhylle/projects/mhylle.com/mhylle-infrastructure/portals/frontend/src/app/pages/family/family.component.html`

**Tasks:**

- [ ] Add a new card entry after the existing cards:

```html
    <a class="card" href="/recipe-manager/">
      <div class="card-icon">&#x1F373;</div>
      <div class="card-content">
        <div class="card-title">Recipe Manager</div>
        <div class="card-desc">Manage recipes, pantry inventory, meal plans, and shopping lists. Inventory-aware recipe matching.</div>
        <div class="card-tags">
          <span class="tag">Family</span>
          <span class="tag">Kitchen</span>
        </div>
      </div>
      <div class="card-arrow">&rarr;</div>
    </a>
```

**Note**: The card-icon uses the HTML entity `&#x1F373;` (cooking/frying pan emoji) to avoid embedding a literal emoji in the source file, per the no-emoji convention. Alternatively, use a text-based icon or an SVG.

### Step 3.5: Configure GitHub Repository Secrets

**Manual steps (not automatable):**

- [ ] In the `mhylle/recipe-manager` GitHub repository settings, add the following secrets:
  - `SERVER_HOST` -- the Scaleway server IP/hostname
  - `SERVER_USER` -- SSH username
  - `SERVER_SSH_KEY` -- SSH private key
  - `SERVER_PORT` -- SSH port (if not 22)
- [ ] Create a `production` environment in GitHub repo settings for the deploy job
- [ ] These secrets should match those already configured for child-heights

### Step 3.6: Server-Side Manual Setup

**One-time manual steps on the server before first deployment:**

- [ ] Add `RECIPE_MANAGER_DB_PASSWORD` to `/home/mhylle/projects/mhylle.com/.env`
- [ ] Create the database and user via psql (see Step 3.1 for the commands)
- [ ] Trigger the deploy-portals workflow to update nginx with the new location blocks
- [ ] Verify nginx reload succeeds: `docker exec mhylle-nginx nginx -t`

### Step 3.7: Verify End-to-End

- [ ] Push to `main` branch, verify GitHub Actions workflow succeeds
- [ ] `https://mhylle.com/recipe-manager/` loads the Angular app
- [ ] `https://mhylle.com/api/recipe-manager/health` returns `{ "status": "ok" }`
- [ ] `https://mhylle.com/api/recipe-manager/recipes` returns `[]` (empty database)
- [ ] Create a recipe via the UI, verify it persists across page refreshes
- [ ] Full CRUD workflow through the production URL
- [ ] Verify the recipe-manager card appears on `https://mhylle.com/portals/family`
- [ ] `docker ps` on the server shows both containers healthy

**Exit Conditions:**
- Both containers running and healthy on the server
- nginx correctly routes `/recipe-manager/` and `/api/recipe-manager/`
- All API endpoints accessible through the production URL
- Portals dashboard shows the recipe-manager card
- GitHub Actions pipeline runs green on push to `main`
- Zero errors, zero warnings

---

## Phase Dependencies

```
Phase 1 (Prisma + PostgreSQL)
  └── Phase 2 (Docker Setup)
        └── Phase 3 (Infrastructure Integration)
              ├── Step 3.1 (init-databases.sql) -- in mhylle-infrastructure repo
              ├── Step 3.2 (nginx location blocks) -- in deploy-portals.yml
              ├── Step 3.3 (deploy.yml) -- in recipe-manager repo
              ├── Step 3.4 (portals card) -- in mhylle-infrastructure repo
              └── Step 3.6 (server setup) -- manual
```

## Files to Create

| File | Description |
|------|-------------|
| `backend/prisma/schema.prisma` | Prisma schema with all 8 models |
| `backend/src/prisma/prisma.service.ts` | NestJS-injectable Prisma client |
| `backend/src/prisma/prisma.module.ts` | Global Prisma module |
| `backend/.env` | Local DATABASE_URL (gitignored) |
| `backend/.env.example` | Template for DATABASE_URL |
| `backend/Dockerfile` | Multi-stage Node 22 build |
| `frontend/Dockerfile` | Multi-stage Angular build + nginx |
| `frontend/nginx.conf` | SPA routing + health endpoint |
| `frontend/src/environments/environment.ts` | Dev environment config |
| `frontend/src/environments/environment.prod.ts` | Prod environment config (apiUrl: '/api/recipe-manager') |
| `docker-compose.yml` | Local dev compose (postgres + backend + frontend) |
| `docker-compose.prod.yml` | Production reference compose |
| `.github/workflows/deploy.yml` | CI/CD pipeline |

## Files to Modify

| File | Change |
|------|--------|
| `backend/package.json` | Add prisma, @prisma/client, @prisma/adapter-pg, pg, dotenv |
| `backend/src/app.module.ts` | Import PrismaModule, remove StorageModule |
| `backend/src/main.ts` | Add dotenv import, update CORS for production |
| `backend/src/app.controller.ts` | Add /health endpoint |
| `backend/src/recipe/recipe.repository.ts` | Rewrite for Prisma |
| `backend/src/pantry/pantry.repository.ts` | Rewrite for Prisma |
| `backend/src/meal-plan/meal-plan.repository.ts` | Rewrite for Prisma |
| `backend/src/shopping-list/shopping-list.repository.ts` | Rewrite for Prisma |
| `backend/src/staples/staples.service.ts` | Rewrite for Prisma |
| `backend/src/shared/interfaces/meal-plan.interface.ts` | Add id to MealPlanEntry |
| `backend/src/shared/interfaces/shopping-list.interface.ts` | Add id to ShoppingListItem |
| `backend/src/meal-plan/meal-plan.service.ts` | Use entry IDs instead of indices |
| `backend/src/shopping-list/shopping-list.service.ts` | Use item IDs instead of indices |
| `frontend/src/app/shared/models/meal-plan.model.ts` | Add id to MealPlanEntry |
| `frontend/src/app/shared/models/shopping-list.model.ts` | Add id to ShoppingListItem |
| `frontend/src/app/features/recipe/recipe.service.ts` | Use environment.apiUrl |
| `frontend/src/app/features/pantry/pantry.service.ts` | Use environment.apiUrl |
| `frontend/src/app/features/meal-plan/meal-plan.service.ts` | Use environment.apiUrl, use entry IDs |
| `frontend/src/app/features/shopping-list/shopping-list.service.ts` | Use environment.apiUrl, use item IDs |
| `frontend/src/app/features/staples/staples.service.ts` | Use environment.apiUrl |
| `frontend/src/app/features/dashboard/dashboard.service.ts` | Use environment.apiUrl |
| `frontend/angular.json` | Add fileReplacements for production |
| `**/mhylle-infrastructure/scripts/init-databases.sql` | Add recipe_manager_db |
| `**/mhylle-infrastructure/.github/workflows/deploy-portals.yml` | Add nginx location blocks |
| `**/mhylle-infrastructure/portals/.../family.component.html` | Add recipe-manager card |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prisma migration fails on production PostgreSQL | App cannot start | Test migration against PostgreSQL 15 locally first; backend CMD runs migrate deploy before starting the app, so failures are visible in container logs |
| Nginx upstream not found (container not yet running) | nginx reload fails | Use dynamic upstream pattern with `set $variable` + `resolver 127.0.0.11` (already used for child-heights, drop-n-drive, scalper) |
| Data type mismatch (Decimal vs number) | API contract breaks | Map Prisma Decimal to JavaScript number in each repository before returning |
| Index-based entry/item references break | Meal plan and shopping list operations fail | Migrate to ID-based references in Phase 1; update both backend and frontend simultaneously |
| Angular `fileReplacements` misconfigured | Production frontend hits wrong API URL | Test production build locally: `npm run build -- --configuration=production` and verify the bundled environment values |
| Server .env missing RECIPE_MANAGER_DB_PASSWORD | Backend container crashes on startup | Document the manual step; deploy script logs clear error if DATABASE_URL is malformed |
| Prisma Client not generated in Docker build | Runtime import error | Dockerfile explicitly runs `npx prisma generate` in builder stage and copies `node_modules/.prisma` to production stage |
