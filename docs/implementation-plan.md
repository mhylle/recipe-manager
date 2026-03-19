# Implementation Plan: Recipe Manager with Inventory Awareness

## Overview

A full-stack web application that manages pantry inventory, recipes, meal planning, and shopping lists. The system uses file-per-record JSON storage, an Angular 21 frontend with signals and standalone components, and a NestJS 11 backend with module-per-domain architecture. The core differentiator is inventory-aware recipe matching: the app classifies recipes by pantry availability and generates consolidated shopping lists from meal plans.

## Context

Both frontend and backend are freshly scaffolded with no application logic yet. The frontend is Angular 21 (standalone components, signals, Vitest) at `/intro/frontend`. The backend is NestJS 11 (Express, Jest) at `/intro/backend`. There are no data directories, no shared types, no API routes, and no UI beyond the Angular welcome page.

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation & Storage Layer | COMPLETED | All storage, interfaces, enums, DTOs, CORS, proxy, validation configured |
| Phase 2: Pantry CRUD | COMPLETED | 16 files created, 5 modified. Backend: 34 tests (4 suites), Frontend: 17 tests (4 suites). Controller->Service->Repository pattern, OnPush, signals, reactive forms. |
| Phase 3: Recipe CRUD | COMPLETED | 10 files created, 3 modified. Backend: 52 tests (6 suites), Frontend: 38 tests (7 suites). Dynamic ingredient FormArray, nested DTO validation, card-based recipe grid, difficulty badges. Playwright verified: create with 3 ingredients, edit add/remove ingredient, delete. |
| Phase 4: Staples Config & Recipe Matching | COMPLETED | 12 files created, 2 modified. Backend: 66 tests (8 suites), Frontend: 50 tests (10 suites). Staples CRUD, matching engine (3 buckets), dashboard with collapsible sections. Route ordering fix for /recipes/match vs /recipes/:id. Playwright verified: 3 buckets, staples add/remove, matching classifications. |
| Phase 5: Expiry Awareness | COMPLETED | 4 files created, 4 modified. Backend: 70 tests (9 suites), Frontend: 54 tests (11 suites). Expiry helper, expiry badges (red/amber), /api/pantry/expiring endpoint, matching expiry-priority sorting, dashboard "Use it soon!" labels. Playwright verified badges. |
| Phase 6: Meal Planner & Pantry Deduction | COMPLETED | 12 files created, 3 modified. Backend: 76 tests (10 suites), Frontend: 62 tests (13 suites). 7x4 meal grid, recipe picker dialog, deduction service, confirm cooked. Playwright verified: grid, recipe assignment, picker dialog. |
| Phase 7: Shopping List Generation | COMPLETED | 10 files created, 2 modified. Backend: 81 tests (11 suites), Frontend: 68 tests (15 suites). Consolidation helper, generate from meal plan, check/uncheck items, pantry deduction. Playwright verified generation and empty-when-all-in-pantry. |
| Phase 8: Search & Filter | COMPLETED | 4 files created, 4 modified. Backend: 81 tests (11 suites), Frontend: 71 tests (16 suites). Recipe filters (search, difficulty, prep time, tags), pantry filters (search, category), backend query params. Playwright verified difficulty filtering. |

## Design Decision

Module-per-domain architecture: each domain entity (pantry, recipe, meal-plan, shopping-list, staples) gets its own NestJS module with controller/service/repository and its own Angular feature route with lazy-loaded components and a dedicated Angular service. A shared `FileStorageService` provides generic file-per-record JSON persistence.

## Architecture Principles

- Separation of concerns
- Single responsibility pattern
- Service delegation
- Helper methods for complex operations
- Repository pattern wrapping generic storage
- Tests first in every phase

## Implementation Phases

### Phase 1: Foundation & Storage Layer — COMPLETED

**Objective**: Establish the generic file-per-record JSON persistence layer, shared TypeScript interfaces, project configuration (CORS, proxy, validation), and data directory structure. Every subsequent phase depends on this foundation.

**Verification Approach**: Unit tests verify that the `FileStorageService` can create, read, update, delete, and list JSON records. Integration test confirms the NestJS app starts with the storage module loaded. Frontend proxy configuration verified by a successful proxied request to the backend.

**Tasks**:

Backend:
- [x] Write tests: `src/storage/file-storage.service.spec.ts` covering create (generates ID, writes file), read (returns parsed JSON, throws on missing), update (merges fields, updates timestamp), delete (removes file, throws on missing), list (returns all records, returns empty array for empty dir), concurrent write safety
- [x] Implement: `src/storage/file-storage.service.ts` — generic `FileStorageService<T>` using `fs/promises`, `crypto.randomUUID()` for IDs, atomic writes (write to `.tmp` then rename), auto-creates `data/` subdirectories on first write
- [x] Implement: `src/storage/storage.module.ts` — NestJS module exporting `FileStorageService`
- [x] Implement: `src/shared/interfaces/` — TypeScript interfaces for all domain entities:
  - `pantry-item.interface.ts`: `PantryItem { id, name, quantity, unit, category, barcode?, expiryDate?, addedDate, lastUpdated }`
  - `recipe.interface.ts`: `Recipe { id, name, description, servings, instructions: string[], ingredients: RecipeIngredient[], prepTime, cookTime, difficulty, tags }`; `RecipeIngredient { name, quantity, unit, pantryCategory }`
  - `meal-plan.interface.ts`: `MealPlan { id, weekStartDate, entries: MealPlanEntry[] }`; `MealPlanEntry { day, meal, recipeId, servings }`
  - `shopping-list.interface.ts`: `ShoppingList { id, mealPlanId, generatedDate, items: ShoppingListItem[] }`; `ShoppingListItem { name, quantity, unit, checked }`
  - `staples-config.interface.ts`: `StaplesConfig { items: string[] }`
- [x] Implement: `src/shared/enums/` — enums for `Unit` (metric: g, kg, ml, l, tsp, tbsp, piece, pinch), `Difficulty`, `MealType`, `DayOfWeek`, `PantryCategory`
- [x] Implement: `src/shared/dto/` — base DTO classes with class-validator decorators (install `class-validator` and `class-transformer`)
- [x] Configure: `src/main.ts` — enable CORS (`app.enableCors({ origin: 'http://localhost:4200' })`), add global `ValidationPipe`
- [x] Configure: API prefix — `app.setGlobalPrefix('api')` so all routes are under `/api`

Frontend:
- [x] Implement: `src/app/shared/models/` — mirror TypeScript interfaces (pantry-item, recipe, meal-plan, shopping-list, staples-config) matching backend shapes
- [x] Implement: `src/app/shared/enums/` — mirror enums from backend
- [x] Configure: `src/proxy.conf.json` — proxy `/api` to `http://localhost:3000`
- [x] Configure: `src/app/app.config.ts` — add `provideHttpClient(withFetch())` to providers
- [x] Configure: `angular.json` — add `proxyConfig` to serve options

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/backend && npm run lint` passes
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] `cd /intro/backend && npm run start:dev` starts on port 3000 without errors
- [x] `cd /intro/frontend && npm start` starts on port 4200 without errors
- [x] Frontend proxied request to `http://localhost:4200/api` returns backend response

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (FileStorageService unit tests)
- [x] FileStorageService creates `data/test/{id}.json` file on disk
- [x] FileStorageService reads back identical object
- [x] FileStorageService lists all records in a directory
- [x] FileStorageService deletes record and file is removed

---

### Phase 2: Pantry CRUD — COMPLETED

**Objective**: Full create/read/update/delete for pantry items, with backend REST API and frontend UI including form validation, list view, and edit capability.

**Verification Approach**: Backend unit tests verify the pantry service and controller. E2e test confirms the full HTTP request cycle. Frontend component tests verify form validation and list rendering. Manual check confirms adding/editing/deleting a pantry item through the UI.

**Tasks**:

Backend:
- [x] Write tests: `src/pantry/pantry.service.spec.ts` covering create (validates required fields, generates ID, sets addedDate/lastUpdated), getAll (returns all items), getById (returns item, throws NotFoundException on missing), update (merges fields, updates lastUpdated), delete (removes item)
- [x] Write tests: `src/pantry/pantry.controller.spec.ts` covering POST /api/pantry, GET /api/pantry, GET /api/pantry/:id, PATCH /api/pantry/:id, DELETE /api/pantry/:id
- [x] Implement: `src/pantry/dto/create-pantry-item.dto.ts` — class-validator decorated DTO
- [x] Implement: `src/pantry/dto/update-pantry-item.dto.ts` — PartialType of create DTO
- [x] Implement: `src/pantry/pantry.repository.ts` — wraps FileStorageService for `data/pantry/` directory
- [x] Implement: `src/pantry/pantry.service.ts` — business logic, delegates to repository
- [x] Implement: `src/pantry/pantry.controller.ts` — REST endpoints with validation pipes
- [x] Implement: `src/pantry/pantry.module.ts` — NestJS module

Frontend:
- [x] Write tests: `src/app/features/pantry/pantry.service.spec.ts` covering HTTP calls to backend API
- [x] Write tests: `src/app/features/pantry/pantry-list/pantry-list.spec.ts` covering list rendering, empty state, delete confirmation
- [x] Write tests: `src/app/features/pantry/pantry-form/pantry-form.spec.ts` covering form validation (required fields, numeric quantity), submit behavior
- [x] Implement: `src/app/features/pantry/pantry.service.ts` — Angular service using `HttpClient`, returns signals/observables
- [x] Implement: `src/app/features/pantry/pantry-list/pantry-list.ts` — standalone component with `ChangeDetectionStrategy.OnPush`, `@for` loop, delete button
- [x] Implement: `src/app/features/pantry/pantry-form/pantry-form.ts` — standalone component with reactive form, validation, create/edit modes
- [x] Implement: `src/app/features/pantry/pantry-detail/pantry-detail.ts` — standalone component showing single item details
- [x] Implement: `src/app/features/pantry/pantry.routes.ts` — lazy-loaded child routes
- [x] Register: pantry routes in `src/app/app.routes.ts`
- [x] Implement: basic layout component (`src/app/layout/`) with navigation sidebar/header linking to Pantry (and placeholder links for future features)

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/backend && npm run lint` passes
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] Backend starts and `curl http://localhost:3000/api/pantry` returns `[]`
- [x] POST to `/api/pantry` with valid body returns 201 and created item
- [x] Frontend starts and navigating to `/pantry` renders the list view

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (pantry service + controller tests)
- [x] `cd /intro/frontend && npm test` passes (pantry service + component tests)
- [x] Create a pantry item through the UI, verify it appears in the list (Playwright verified 2026-03-19)
- [x] Edit a pantry item, verify changes persist (Playwright verified 2026-03-19)
- [x] Delete a pantry item, verify it disappears (Playwright verified 2026-03-19)

---

### Phase 3: Recipe CRUD — COMPLETED

**Objective**: Full create/read/update/delete for recipes, with dynamic ingredient list management, tag input, and all recipe metadata (prep time, cook time, difficulty, servings).

**Verification Approach**: Backend unit tests verify recipe service CRUD. Frontend component tests verify the dynamic ingredient form array, tag input, and list rendering with filtering.

**Tasks**:

Backend:
- [x] Write tests: `src/recipe/recipe.service.spec.ts` covering create (validates ingredients array, generates ID), getAll, getById, update (can add/remove ingredients), delete
- [x] Write tests: `src/recipe/recipe.controller.spec.ts` covering all REST endpoints
- [x] Implement: `src/recipe/dto/create-recipe.dto.ts` — nested validation for ingredients array
- [x] Implement: `src/recipe/dto/update-recipe.dto.ts`
- [x] Implement: `src/recipe/recipe.repository.ts` — wraps FileStorageService for `data/recipes/`
- [x] Implement: `src/recipe/recipe.service.ts`
- [x] Implement: `src/recipe/recipe.controller.ts` — `@Controller('recipes')`
- [x] Implement: `src/recipe/recipe.module.ts`

Frontend:
- [x] Write tests: `src/app/features/recipe/recipe.service.spec.ts`
- [x] Write tests: `src/app/features/recipe/recipe-list/recipe-list.spec.ts` covering list rendering, difficulty badges, time display
- [x] Write tests: `src/app/features/recipe/recipe-form/recipe-form.spec.ts` covering dynamic FormArray for ingredients (add row, remove row, validation), tag input
- [x] Implement: `src/app/features/recipe/recipe.service.ts`
- [x] Implement: `src/app/features/recipe/recipe-list/recipe-list.ts` — card-based grid, shows name, difficulty, times, tags
- [x] Implement: `src/app/features/recipe/recipe-form/recipe-form.ts` — reactive form with dynamic ingredient FormArray, multi-select tags, step-by-step instructions editor
- [x] Implement: `src/app/features/recipe/recipe-detail/recipe-detail.ts` — full recipe view with ingredient list, instructions, metadata
- [x] Implement: `src/app/features/recipe/recipe.routes.ts`
- [x] Register: recipe routes in `src/app/app.routes.ts`
- [x] Update: layout navigation to include Recipes link

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/backend && npm run lint` passes
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] `curl http://localhost:3000/api/recipes` returns `[]`
- [x] POST recipe with 3 ingredients returns 201
- [x] Frontend `/recipes` route renders recipe list

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (all tests including recipe)
- [x] `cd /intro/frontend && npm test` passes (all tests including recipe)
- [x] Create a recipe with multiple ingredients via UI (Playwright verified 2026-03-19)
- [x] Edit recipe to add/remove an ingredient (Playwright verified 2026-03-19)
- [x] Delete recipe via UI (Playwright verified 2026-03-19)

---

### Phase 4: Staples Config & Recipe Matching — COMPLETED

**Objective**: Implement the staples configuration (user-defined always-available ingredients) and the recipe matching engine that classifies recipes into three buckets: "can make now", "need 1-2 items", "missing many". Staples are excluded from matching calculations.

**Verification Approach**: Unit tests verify the matching algorithm with various pantry/recipe/staples combinations. The matching endpoint returns correctly categorized recipes. Frontend displays three distinct sections.

**Tasks**:

Backend:
- [x] Write tests: `src/staples/staples.service.spec.ts` covering get (returns default empty list on first access), update (saves list), check if item is staple
- [x] Write tests: `src/matching/matching.service.spec.ts` covering:
  - Recipe with all ingredients in pantry (sufficient quantities) => "can make now"
  - Recipe with all ingredients in pantry but insufficient quantity for one => "need 1-2"
  - Recipe with 1 missing non-staple ingredient => "need 1-2"
  - Recipe with 2 missing ingredients => "need 1-2"
  - Recipe with 3+ missing ingredients => "missing many"
  - Staple ingredients excluded from missing count
  - Servings scaling affects quantity comparison
  - Empty pantry => all recipes in "missing many"
- [x] Implement: `src/staples/staples.service.ts` — reads/writes `data/config/staples.json`
- [x] Implement: `src/staples/staples.controller.ts` — GET/PUT `/api/staples`
- [x] Implement: `src/staples/staples.module.ts`
- [x] Implement: `src/matching/matching.service.ts` — core matching logic
- [x] Implement: `src/matching/matching.controller.ts` — GET `/api/recipes/match` with optional servings query param
- [x] Implement: `src/matching/matching.module.ts` — imports PantryModule, RecipeModule, StaplesModule

Frontend:
- [x] Write tests: `src/app/features/staples/staples.service.spec.ts`
- [x] Write tests: `src/app/features/staples/staples-config/staples-config.spec.ts` covering add staple, remove staple, save
- [x] Write tests: `src/app/features/dashboard/dashboard.spec.ts` covering three-bucket display, empty states
- [x] Implement: `src/app/features/staples/staples.service.ts`
- [x] Implement: `src/app/features/staples/staples-config/staples-config.ts` — editable list with add/remove
- [x] Implement: `src/app/features/dashboard/dashboard.ts` — home page showing three recipe buckets from matching API, each as a collapsible card list
- [x] Implement: routes for staples config and dashboard
- [x] Update: app routes to set dashboard as default route (`/`)

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/backend && npm run lint` passes
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] `curl http://localhost:3000/api/staples` returns `{ "items": [] }`
- [x] `curl http://localhost:3000/api/recipes/match` returns three buckets
- [x] Frontend dashboard renders three sections (Playwright verified 2026-03-19)

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (all tests including matching)
- [x] `cd /intro/frontend && npm test` passes
- [x] Add salt, pepper, oil to staples; create recipe requiring only those plus pantry items; verify it appears in "can make now" (Playwright verified 2026-03-19)
- [x] Create recipe with 1 ingredient not in pantry; verify "need 1-2 items" bucket (Playwright verified 2026-03-19)
- [x] Create recipe with 5 missing ingredients; verify "missing many" bucket (Playwright verified 2026-03-19)

---

### Phase 5: Expiry Awareness — COMPLETED

**Objective**: Add expiry date awareness to pantry items, with visual badges for items expiring soon (within 3 days) and expired items. Recipe matching prioritizes recipes that use soon-to-expire ingredients.

**Verification Approach**: Unit tests verify expiry classification logic. Matching service tests verify recipes using expiring items are surfaced first. Frontend tests verify badge rendering and sort order.

**Tasks**:

Backend:
- [x] Write tests: `src/pantry/helpers/expiry.helper.spec.ts` covering: expired (past date), expiring soon (within 3 days), fresh (more than 3 days), no expiry date (never expires)
- [x] Write tests: `src/matching/matching.service.spec.ts` — add tests for expiry priority
- [x] Implement: `src/pantry/helpers/expiry.helper.ts` — `getExpiryStatus(expiryDate): 'expired' | 'expiring-soon' | 'fresh' | 'no-expiry'`
- [x] Update: `src/pantry/pantry.service.ts` — add `getExpiringItems(withinDays: number)` method
- [x] Update: `src/matching/matching.service.ts` — add expiry-priority sorting within buckets
- [x] Implement: GET `/api/pantry/expiring?days=3` endpoint

Frontend:
- [x] Write tests: `src/app/shared/pipes/expiry-status.pipe.spec.ts`
- [x] Implement: `src/app/shared/pipes/expiry-status.pipe.ts` — pure pipe returning status string
- [x] Update: `src/app/features/pantry/pantry-list/pantry-list.ts` — add expiry badges
- [x] Update: `src/app/features/dashboard/dashboard.ts` — show "Use it soon!" label for recipes with expiring ingredients

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] Backend starts without errors
- [x] `curl http://localhost:3000/api/pantry/expiring?days=3` returns expiring items

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (including expiry helper tests)
- [x] `cd /intro/frontend && npm test` passes
- [x] Pantry item with expiry date tomorrow shows amber badge (Playwright verified 2026-03-19)
- [x] Pantry item with past expiry date shows red badge (Playwright verified 2026-03-19)
- [x] Dashboard "can make now" section shows expiring-ingredient recipes first

---

### Phase 6: Meal Planner & Pantry Deduction — COMPLETED

**Objective**: Weekly meal planner grid (7 days x 4 meal slots), assign recipes to slots with custom servings, and virtual pantry deduction system that "reserves" ingredients when a meal is planned without removing them from the pantry until the user confirms the meal is cooked.

**Verification Approach**: Unit tests verify meal plan CRUD and the virtual deduction calculation. The deduction service accurately computes "effective available quantity" (actual quantity minus reserved). Recipe matching uses effective quantities. Frontend tests verify the weekly grid renders and selection works.

**Tasks**:

Backend:
- [x] Write tests: `src/meal-plan/meal-plan.service.spec.ts` covering create, get by week, add entry, remove entry, update entry servings
- [x] Implement: `src/meal-plan/dto/create-meal-plan.dto.ts`, `add-meal-plan-entry.dto.ts`
- [x] Implement: `src/meal-plan/meal-plan.repository.ts` — wraps FileStorageService for `data/meal-plans/`
- [x] Implement: `src/meal-plan/meal-plan.service.ts`
- [x] Implement: `src/meal-plan/deduction/deduction.service.ts` — computes effective pantry
- [x] Implement: `src/meal-plan/meal-plan.controller.ts` — CRUD endpoints + confirm cooked
- [x] Implement: `src/meal-plan/meal-plan.module.ts` — imports PantryModule, RecipeModule

Frontend:
- [x] Write tests: `src/app/features/meal-plan/meal-plan.service.spec.ts`
- [x] Write tests: `src/app/features/meal-plan/meal-plan-grid/meal-plan-grid.spec.ts`
- [x] Implement: `src/app/features/meal-plan/meal-plan.service.ts`
- [x] Implement: `src/app/features/meal-plan/meal-plan-grid/meal-plan-grid.ts` — weekly grid with recipe picker
- [x] Implement: `src/app/features/meal-plan/recipe-picker-dialog/recipe-picker-dialog.ts`
- [x] Implement: `src/app/features/meal-plan/meal-plan.routes.ts`
- [x] Update: layout navigation with Meal Plan link

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] `curl http://localhost:3000/api/meal-plans/week?date=2026-03-16` returns meal plan
- [x] POST an entry to meal plan, GET returns updated plan
- [x] Frontend `/meal-plan` renders 7x4 grid (Playwright verified 2026-03-19)

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (all tests including meal plan)
- [x] `cd /intro/frontend && npm test` passes
- [x] Plan a meal for Monday dinner, verify recipe appears in grid (Playwright verified 2026-03-19)

---

### Phase 7: Shopping List Generation — COMPLETED

**Objective**: Auto-generate a shopping list from a meal plan by consolidating all required ingredients across all planned meals, deducting what is available in the pantry (including virtual reservations), deduplicating by name+unit, and presenting a checkable list in the UI.

**Verification Approach**: Unit tests verify the consolidation and deduplication algorithm. Integration test confirms end-to-end generation from meal plan. Frontend tests verify checkbox persistence and list rendering.

**Tasks**:

Backend:
- [x] Write tests: `src/shopping-list/helpers/consolidation.helper.spec.ts` covering same-unit merging, ingredient name normalization
- [x] Implement: `src/shopping-list/helpers/consolidation.helper.ts` — groups ingredients by normalized name + unit, sums quantities
- [x] Implement: `src/shopping-list/shopping-list.repository.ts`
- [x] Implement: `src/shopping-list/shopping-list.service.ts` — generate, findById, toggleItem
- [x] Implement: `src/shopping-list/shopping-list.controller.ts` — POST generate, GET, PATCH toggle
- [x] Implement: `src/shopping-list/shopping-list.module.ts`

Frontend:
- [x] Write tests: `src/app/features/shopping-list/shopping-list.service.spec.ts`
- [x] Write tests: `src/app/features/shopping-list/shopping-list-view/shopping-list-view.spec.ts`
- [x] Implement: `src/app/features/shopping-list/shopping-list.service.ts`
- [x] Implement: `src/app/features/shopping-list/shopping-list-view/shopping-list-view.ts` — checkable list with generate button
- [x] Implement: `src/app/features/shopping-list/shopping-list.routes.ts`
- [x] Update: layout navigation with Shopping List link

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] POST generate returns shopping list
- [x] Frontend `/shopping-list` renders the generated list (Playwright verified 2026-03-19)

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (all tests including consolidation)
- [x] `cd /intro/frontend && npm test` passes
- [x] Items already in pantry (sufficient quantity) do not appear on list (Playwright verified 2026-03-19)

---

### Phase 8: Search & Filter — COMPLETED

**Objective**: Add comprehensive search and filtering across recipes by tags, cuisine, difficulty, prep time, cook time, and pantry availability status. Also add search to pantry by name and category.

**Verification Approach**: Backend unit tests verify filtering logic with various parameter combinations. Frontend tests verify filter UI controls update the displayed results correctly.

**Tasks**:

Backend:
- [x] Update: `src/recipe/recipe.service.ts` — add `RecipeSearchFilters` interface and filtering in `findAll`
- [x] Update: `src/recipe/recipe.controller.ts` — GET `/api/recipes?tags=italian&difficulty=easy&maxPrepTime=30&q=pasta`
- [x] Update: `src/pantry/pantry.service.ts` — add search(query, category) to `findAll`
- [x] Update: `src/pantry/pantry.controller.ts` — GET `/api/pantry?q=flour&category=baking`

Frontend:
- [x] Write tests: `src/app/features/recipe/recipe-filters/recipe-filters.spec.ts` covering filter panel interactions, reset filters
- [x] Implement: `src/app/features/recipe/recipe-filters/recipe-filters.ts` — filter panel with difficulty, tags, search, max prep time
- [x] Update: `src/app/features/recipe/recipe-list/recipe-list.ts` — integrate filter panel
- [x] Implement: `src/app/features/pantry/pantry-filters/pantry-filters.ts` — search bar + category dropdown
- [x] Update: `src/app/features/pantry/pantry-list/pantry-list.ts` — integrate pantry filters

**Exit Conditions:**

Build Verification:
- [x] `cd /intro/backend && npm run build` succeeds
- [x] `cd /intro/frontend && npm run build` succeeds

Runtime Verification:
- [x] `curl 'http://localhost:3000/api/recipes?difficulty=easy'` returns filtered results
- [x] `curl 'http://localhost:3000/api/pantry?q=on'` returns matching items (Onion)
- [x] Frontend filter panel renders and filters update list in real time (Playwright verified 2026-03-19)

Functional Verification:
- [x] `cd /intro/backend && npm test` passes (all tests including search)
- [x] `cd /intro/frontend && npm test` passes
- [x] Filter recipes by "easy" difficulty, verify only easy recipes shown (Playwright verified 2026-03-19)

---

## Phase Dependencies

```
Phase 1 (Foundation)
  ├── Phase 2 (Pantry CRUD)
  ├── Phase 3 (Recipe CRUD)
  │     └── Phase 4 (Staples & Matching) [needs Phases 2 + 3]
  │           ├── Phase 5 (Expiry Awareness)
  │           ├── Phase 6 (Meal Planner & Deduction)
  │           │     └── Phase 7 (Shopping List Generation)
  │           └── Phase 8 (Search & Filter)
```

## Dependencies

- **npm packages to install (backend)**: `class-validator`, `class-transformer`, `@nestjs/mapped-types`
- **npm packages to install (frontend)**: none beyond what is scaffolded (`HttpClient` is in `@angular/common/http`)
- **Node.js**: Must be >= 19 for `crypto.randomUUID()` (likely already satisfied given Angular 21 / NestJS 11 requirements)
- **Data directories**: Created automatically by `FileStorageService` on first write; no manual setup needed
- **No external databases**: File-per-record JSON eliminates DB dependency
- **Open Food Facts API** (barcode lookup): Optional enhancement, can be deferred; graceful fallback if API unavailable

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| File system race conditions on concurrent writes | Data corruption | Atomic write pattern (write to `.tmp` file, then `rename`); single-user mode reduces risk further |
| Large number of records degrades list performance | Slow API responses | For v1 single-user, file-per-record is fine for hundreds of items; add caching/indexing if needed later |
| Unit conversion complexity | Incorrect matching/shopping list quantities | Stick to metric-only as specified; exact unit matching (no cross-unit conversion in v1) |
| Angular 21 API surface changes | Compilation errors | Pin versions in `package.json` (already done); follow `.claude/CLAUDE.md` conventions strictly |
| Frontend test setup with Vitest + Angular | Test configuration issues | Scaffold already includes Vitest integration; follow existing `app.spec.ts` pattern |
| Data directory not in `.gitignore` | Accidental commit of test data | Add `data/` to backend `.gitignore` during Phase 1 |

## File Structure Summary

**Backend** (`/intro/backend/src/`):
```
src/
  shared/
    interfaces/         # Domain entity interfaces
    enums/              # Shared enums
    dto/                # Base DTOs
  storage/
    file-storage.service.ts
    file-storage.service.spec.ts
    storage.module.ts
  pantry/
    pantry.module.ts
    pantry.controller.ts
    pantry.service.ts
    pantry.repository.ts
    dto/
    helpers/
      expiry.helper.ts
  recipe/
    recipe.module.ts
    recipe.controller.ts
    recipe.service.ts
    recipe.repository.ts
    dto/
  staples/
    staples.module.ts
    staples.controller.ts
    staples.service.ts
  matching/
    matching.module.ts
    matching.controller.ts
    matching.service.ts
  meal-plan/
    meal-plan.module.ts
    meal-plan.controller.ts
    meal-plan.service.ts
    meal-plan.repository.ts
    deduction/
      deduction.service.ts
    dto/
  shopping-list/
    shopping-list.module.ts
    shopping-list.controller.ts
    shopping-list.service.ts
    shopping-list.repository.ts
    helpers/
      consolidation.helper.ts
    dto/
```

**Frontend** (`/intro/frontend/src/app/`):
```
app/
  shared/
    models/             # TypeScript interfaces
    enums/              # Shared enums
    pipes/              # ExpiryStatusPipe, etc.
  layout/               # Shell component with nav
  features/
    pantry/
      pantry.service.ts
      pantry-list/
      pantry-form/
      pantry-detail/
      pantry-filters/
      pantry.routes.ts
    recipe/
      recipe.service.ts
      recipe-list/
      recipe-form/
      recipe-detail/
      recipe-filters/
      recipe.routes.ts
    staples/
      staples.service.ts
      staples-config/
    meal-plan/
      meal-plan.service.ts
      meal-plan-grid/
      recipe-picker-dialog/
      meal-plan.routes.ts
    shopping-list/
      shopping-list.service.ts
      shopping-list-view/
      shopping-list.routes.ts
    dashboard/
      dashboard.ts
```

## Critical Files

- `/intro/backend/src/app.module.ts` — Root module where all feature modules must be imported
- `/intro/frontend/src/app/app.routes.ts` — Root routing file for lazy-loaded feature routes
- `/intro/frontend/src/app/app.config.ts` — Application config needing `provideHttpClient()`
- `/intro/backend/src/main.ts` — Entry point needing CORS, ValidationPipe, and global prefix
- `/intro/frontend/.claude/CLAUDE.md` — Angular conventions all frontend code must follow

## Deferred Features (post-v1)

- Receipt OCR for pantry entry
- Multi-user support
- Price tracking on shopping lists
- Recipe URL import/parsing
- Barcode scanning via Open Food Facts API
