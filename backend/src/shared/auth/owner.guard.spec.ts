import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { OwnerGuard } from './owner.guard';
import type { RequestWithUser } from './request-with-user';

const OWNER_SUBJECT = '97f9ac37-13ef-4bef-964a-5da09d776497';

function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const asUser = (ssoSubject: string) => ({
  id: 'local-1',
  ssoSubject,
  email: 'someone@example.com',
  displayName: 'Someone',
});

describe('OwnerGuard', () => {
  let guard: OwnerGuard;
  const saved = process.env.RECIPE_MANAGER_SERVICE_USER;

  beforeEach(() => {
    process.env.RECIPE_MANAGER_SERVICE_USER = OWNER_SUBJECT;
    guard = new OwnerGuard();
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.RECIPE_MANAGER_SERVICE_USER;
    } else {
      process.env.RECIPE_MANAGER_SERVICE_USER = saved;
    }
  });

  it('admits the configured owner', () => {
    expect(guard.canActivate(contextFor({ user: asUser(OWNER_SUBJECT) }))).toBe(
      true,
    );
  });

  it('refuses everybody else', () => {
    expect(() =>
      guard.canActivate(contextFor({ user: asUser('somebody-else-entirely') })),
    ).toThrow(ForbiddenException);
  });

  it('refuses everybody when no owner is configured', () => {
    // An admin page that opens up because an env var went missing is the worst
    // possible failure mode, so absence denies rather than admits.
    delete process.env.RECIPE_MANAGER_SERVICE_USER;

    expect(() =>
      guard.canActivate(contextFor({ user: asUser(OWNER_SUBJECT) })),
    ).toThrow(ForbiddenException);
  });

  it('tolerates a trailing newline in the configured subject', () => {
    // The same deployment-secret hazard JWT_SECRET is trimmed for.
    process.env.RECIPE_MANAGER_SERVICE_USER = `${OWNER_SUBJECT}\n`;
    expect(guard.canActivate(contextFor({ user: asUser(OWNER_SUBJECT) }))).toBe(
      true,
    );
  });

  it('reports a missing SsoAuthGuard as a wiring fault, not a permission one', () => {
    expect(() => guard.canActivate(contextFor({}))).toThrow(
      InternalServerErrorException,
    );
  });
});
