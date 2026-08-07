# Private recipes

A recipe can be marked private so only the author's kitchen sees it. Default is
visible — the shared library stays the norm, privacy is the exception.

## Decisions

- **Scope**: `Recipe.pantryId` pins a private recipe to one kitchen. Its members
  see it; nobody else does. Chosen over "anyone sharing a kitchen with the
  author" because a user can belong to two kitchens, and a recipe meant for home
  must not surface in the summerhouse.
- **Default**: `isPrivate = false`. Existing rows stay visible, which is what
  they are today.
- **Author safety net**: the author always sees their own private recipe, even
  after leaving the kitchen it was pinned to. A private recipe whose pantry was
  deleted (`pantryId` null) falls back to author-only — never to public.
- **Live data change** (author → Heidi, mark private on the cheesecake) happens
  after this ships, as a separate step.

## The policy this changes

`GET /recipes` and `GET /recipes/:id` are unguarded today and
`guard-coverage.spec.ts` asserts it: *"keeps RECIPE reads public — the library is
shared"*. Guests must keep browsing, so the fix is optional authentication, not a
guard: resolve the caller when credentials are present, stay anonymous otherwise,
never throw. The read then filters by what that caller may see.

## Tasks

### Backend — schema
- [ ] `isPrivate Boolean @default(false)` and `pantryId String?` on Recipe,
      relation to Pantry with `onDelete: SetNull`, `recipes Recipe[]` on Pantry
- [ ] Index for the visibility filter
- [ ] Migration

### Backend — read path (the load-bearing part)
- [ ] `OptionalSsoAuthGuard`: sets `request.user` when credentials resolve,
      returns true regardless, never throws
- [ ] `RecipeVisibility` — caller's id + pantry ids, or anonymous
- [ ] `visibilityWhere(viewer)` builder, combined into the existing WHERE via
      `AND` (top-level `OR` is already taken by the text search)
- [ ] Thread the viewer through controller → service → repository for
      `findAll`, `findById`, `findAllTranslations`

### Backend — write path
- [ ] `isPrivate` on create/update DTOs
- [ ] Capture the author's kitchen as `pantryId` on create, via
      `PantryAccessService.resolve`
- [ ] Only the author may change `isPrivate` (existing `assertCanModify` covers
      it — confirm with a test)

### Backend — tests
- [ ] Visibility unit tests: anonymous, non-member, member, author, author who
      left, orphaned pantry
- [ ] Repository/service/controller tests for the threaded viewer
- [ ] Update `guard-coverage.spec.ts` to pin the NEW policy: recipe reads carry
      the optional guard, never 401, still not contributor-gated
- [ ] Confirm private recipes are invisible to the MCP service-token caller

### Frontend
- [ ] `isPrivate` on the Recipe model; pass through `recipe.service.ts`
- [ ] Toggle in the recipe form, default off
- [ ] Badge on list + detail so "private" is visible without opening the form
- [ ] i18n keys in `en.ts` and `da.ts` (the check script fails on literals)
- [ ] Component tests

### Verification
- [ ] Backend: tests, lint (0/0), build
- [ ] Frontend: tests, build, `npm run check:i18n`
- [ ] mcp-server tests

## Review

Done, and green: backend 350 tests / 37 suites, lint 0/0, build clean; frontend
426 tests / 48 files, build clean, i18n check clean; mcp-server 34 tests.

### The design changed once, mid-build

The first cut threaded a `viewer: RecipeViewer | null = null` parameter from the
controller down through the service to the repository. That was wrong twice over
and the review that caught it was right:

- The service imported the type only to pass it through untouched — it never
  used it. The layering said "the controller decides who may read", which put
  the decision in the layer least able to enforce it.
- Worse, the `= null` default meant a forgotten argument silently became
  *anonymous*. Three internal callers already existed — `matching`,
  `shopping-list`, `deduction` — and every one of them would have quietly
  started treating its reads as a guest's. A private recipe in your own meal
  plan would have broken the shopping list built from it.

It is now a `RecipeAudience` union — a viewer, `ANONYMOUS`, or `UNRESTRICTED` —
and the repository parameter is required. There is no default to forget, and
each call site states which of the three it means. The compiler found all seven
call sites the moment the default came off.

`matching` respects visibility (it suggests recipes to a person, and suggesting
one they cannot open is worse than not suggesting it). `shopping-list` and
`deduction` are `UNRESTRICTED`, because they resolve a recipe the reader already
put in their own meal plan — authorisation happened before the entry was ever
readable.

### The policy test passed when it should not have

`guard-coverage.spec.ts` asserted "recipe reads are unguarded" and kept passing
after the change, because `guarded` is an identity check against `SsoAuthGuard`
and `OptionalSsoAuthGuard` is a different class object. It now records the
optional guard separately and asserts both halves of the real policy: reads
never *require* credentials, and every recipe read *is* identity-aware. Dropping
the optional guard would fail no other test — the read would still answer, and
would simply treat everyone as a guest.

### Worth knowing

- A recipe the caller may not read returns 404, not 403. Guessing an id should
  not confirm that it exists — the same reasoning already in `assertCanModify`.
- `create` records `pantryId` even for public recipes, so making one private
  later does not have to guess which kitchen was meant.
- The frontend sends `pantryId` on create explicitly rather than via the
  kitchen-scoped interceptor, which also covers reads — the shared library has
  no business carrying a kitchen id.

### Not done here

The live data change (author → Heidi, mark the cheesecake private) is deliberately
still outstanding. It needs this deployed first, and reassigning authorship has
no API — so it wants an agreed way to reach production before anything runs.
