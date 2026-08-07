import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OptionalSsoAuthGuard } from './optional-sso-auth.guard';
import { SsoAuthGuard } from './sso-auth.guard';
import type { RequestWithUser } from './request-with-user.js';

/**
 * The guard that lets recipe reads stay open to guests while still learning who
 * the caller is when they happen to be signed in. Everything here is about the
 * difference between "no credentials" and "bad credentials" — both must produce
 * a guest rather than a 401, or the shared library stops being browsable.
 */
function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request as RequestWithUser }),
  } as ExecutionContext;
}

describe('OptionalSsoAuthGuard', () => {
  let guard: OptionalSsoAuthGuard;
  let inner: jest.SpyInstance;

  beforeEach(() => {
    guard = new OptionalSsoAuthGuard(
      {} as never, // UserService — the base guard is stubbed out below
      {} as never, // McpKeyService
    );
    inner = jest.spyOn(SsoAuthGuard.prototype, 'canActivate');
  });

  afterEach(() => {
    inner.mockRestore();
  });

  it('lets a caller with no credentials through as a guest', async () => {
    inner.mockRejectedValue(
      new UnauthorizedException('Missing authentication token'),
    );
    const request: Partial<RequestWithUser> = {};

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('lets a caller with expired credentials through as a guest', async () => {
    // A stale cookie must degrade to the public library, not lock someone out
    // of a page that guests can read perfectly well.
    inner.mockRejectedValue(
      new UnauthorizedException('Invalid or expired token'),
    );
    const request: Partial<RequestWithUser> = {};

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('keeps the resolved user when credentials are good', async () => {
    // The distractor: a guard that always returned true without delegating
    // would pass both cases above and make every caller anonymous, silently
    // hiding people's own private recipes from them.
    const request: Partial<RequestWithUser> = {};
    inner.mockImplementation((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<RequestWithUser>();
      req.user = { id: 'u-martin' } as never;
      return Promise.resolve(true);
    });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u-martin' });
  });

  it('does not swallow a failure that is not an auth failure', async () => {
    // A database outage while resolving the user is not "this person is a
    // guest" — degrading it to one would serve a wrong answer as a normal page.
    inner.mockRejectedValue(new Error('connection terminated'));

    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(
      'connection terminated',
    );
  });
});
