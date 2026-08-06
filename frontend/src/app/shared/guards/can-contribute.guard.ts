import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { map, type Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Keeps the recipe form out of reach of accounts that may not use it.
 *
 * Not security — the backend refuses the write regardless, and this guard runs
 * in code the browser could edit. It exists to avoid a dead end: without it a
 * self-registered cook can navigate straight to /recipes/new, fill in a long
 * form, and only discover on submit that the API will 403 it.
 *
 * Redirects to the library rather than showing an error page, because "here are
 * the recipes you can read" is the useful answer to "you cannot add one".
 */
export const canContributeGuard: CanActivateFn = ():
  | boolean
  | UrlTree
  | Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Already known — the ordinary case, someone clicking through from the list.
  if (auth.canContribute()) {
    return true;
  }

  // False here is ambiguous: either the account genuinely may not contribute, or
  // the session simply has not resolved yet. A cold navigation straight to this
  // URL — a bookmark, a reload, a shared link — runs the guard before /api/me
  // has answered, and bouncing a legitimate contributor in that window would be
  // a bug that only ever showed up on refresh. Resolving first tells them apart.
  return auth
    .refresh()
    .pipe(map(() => auth.canContribute() || router.createUrlTree(['/recipes'])));
};
