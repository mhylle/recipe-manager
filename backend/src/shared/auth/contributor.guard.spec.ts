import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ContributorGuard } from './contributor.guard';
import { grantsAppAccess, APP_NAME } from './app-access';
import type { RequestWithUser } from './request-with-user';

function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('grantsAppAccess', () => {
  it('accepts a grant for this app', () => {
    expect(grantsAppAccess(['games', APP_NAME])).toBe(true);
  });

  it('rejects an account granted other apps only', () => {
    // The default a newly registered account comes back with. Such a person may
    // sign in and run their own kitchen, but not write to the shared library.
    expect(grantsAppAccess(['games'])).toBe(false);
  });

  it('rejects an empty grant list', () => {
    expect(grantsAppAccess([])).toBe(false);
  });

  it('denies when the claim is missing or malformed', () => {
    // A token with no apps array is either an account granted nothing or
    // something not worth trusting; both should read the same way.
    expect(grantsAppAccess(undefined)).toBe(false);
    expect(grantsAppAccess(null)).toBe(false);
    expect(grantsAppAccess('recipe-manager')).toBe(false);
    expect(grantsAppAccess({ 0: APP_NAME })).toBe(false);
  });

  it('does not match on a substring', () => {
    expect(grantsAppAccess(['recipe-manager-admin'])).toBe(false);
    expect(grantsAppAccess(['recipe'])).toBe(false);
  });
});

describe('ContributorGuard', () => {
  let guard: ContributorGuard;

  beforeEach(() => {
    guard = new ContributorGuard();
  });

  it('lets a granted account through', () => {
    expect(guard.canActivate(contextFor({ canContribute: true }))).toBe(true);
  });

  it('refuses an account without the grant', () => {
    expect(() =>
      guard.canActivate(contextFor({ canContribute: false })),
    ).toThrow(ForbiddenException);
  });

  it('names the app in the refusal, so the fix is obvious', () => {
    expect(() =>
      guard.canActivate(contextFor({ canContribute: false })),
    ).toThrow(new RegExp(APP_NAME));
  });

  it('reports a missing SsoAuthGuard as a wiring fault, not a permission one', () => {
    // 403 here would send someone hunting through grants for a route that never
    // authenticated anybody.
    expect(() => guard.canActivate(contextFor({}))).toThrow(
      InternalServerErrorException,
    );
  });
});
