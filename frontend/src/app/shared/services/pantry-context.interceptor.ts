import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { PantryContextService } from './pantry-context.service';

/**
 * API areas whose data belongs to a KITCHEN rather than to a person.
 *
 * An allowlist, deliberately. A denylist would silently attach a pantry id to
 * every endpoint added later — including ones where a stray `pantryId` would be
 * meaningless at best and misleading at worst.
 *
 * `pantries` (plural) is absent on purpose: creating and sharing address a
 * kitchen by path segment, and those routes take the id from the URL.
 */
const KITCHEN_SCOPED = [
  'pantry',
  // PLURAL, matching the controllers: meal-plans and shopping-lists. Getting
  // these singular shipped an interceptor that skipped both — and the boundary
  // check below, which exists to keep `/api/pantries` out, is precisely what
  // excluded them. Every entry here is copied from a @Controller() path.
  'meal-plans',
  'shopping-lists',
  'staples',
  'recipes/match',
  'bilkatogo',
];

/**
 * Whether this path addresses kitchen-scoped data.
 *
 * Matched at a path BOUNDARY anywhere in the path, not as a leading prefix,
 * because `environment.apiBase` differs between builds: it is empty in dev and
 * `/api/recipe-manager` in production. A leading-prefix match on `/api/pantry`
 * therefore worked in every test and matched nothing whatsoever once deployed —
 * caught only because one test used a production-shaped URL.
 *
 * The boundary check is what keeps `/api/pantries` out while letting
 * `/api/pantry/expiring` in.
 */
function isKitchenScoped(path: string): boolean {
  return KITCHEN_SCOPED.some((area) => {
    const needle = `/api/${area}`;
    const at = path.indexOf(needle);
    if (at === -1) return false;
    const rest = path.slice(at + needle.length);
    return rest === '' || rest.startsWith('/');
  });
}

/**
 * Tells the backend which kitchen a request is about.
 *
 * Twenty routes across six controllers accept `?pantryId=`, and the frontend was
 * sending it on none of them. Every request therefore fell through to the
 * backend's default-pantry fallback — the one you own, else the first you
 * joined — which meant the kitchen switcher changed the selection, triggered a
 * reload, and fetched the same kitchen again. It was decorative.
 *
 * Nobody noticed because the switcher only renders for someone who belongs to
 * more than one kitchen, and until sharing was used in earnest that was nobody.
 *
 * Done here rather than in each service because "every kitchen-scoped request
 * carries the current kitchen" is one rule, and threading it through twenty call
 * sites is how it came to be forgotten in the first place.
 */
export const pantryContextInterceptor: HttpInterceptorFn = (req, next) => {
  const path = req.url.startsWith('http')
    ? new URL(req.url).pathname
    : req.url.split('?')[0];

  if (!isKitchenScoped(path)) {
    return next(req);
  }

  // An explicit id in the request wins. Sharing and any future caller that knows
  // better than the ambient selection must not be overridden.
  if (req.params.has('pantryId')) {
    return next(req);
  }

  const pantryId = inject(PantryContextService).currentId();
  // Null before the kitchen list has loaded. Sending nothing is correct then —
  // the backend resolves the default, which is the right answer for a first load.
  if (!pantryId) {
    return next(req);
  }

  return next(req.clone({ params: req.params.set('pantryId', pantryId) }));
};
