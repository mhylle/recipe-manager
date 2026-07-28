import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SsoAuthGuard } from './sso-auth.guard.js';
import type { RequestWithUser } from './request-with-user.js';

const SECRET = 'test-jwt-secret-value-for-unit-tests';
const SERVICE_TOKEN = 'service-token-with-at-least-32-characters-of-entropy';

function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request as RequestWithUser }),
  } as ExecutionContext;
}

function sign(payload: Record<string, unknown>, secret = SECRET, options: jwt.SignOptions = {}) {
  return jwt.sign({ sub: 'user-1', email: 'someone@example.com', ...payload }, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
    ...options,
  });
}

describe('SsoAuthGuard', () => {
  let guard: SsoAuthGuard;
  const savedSecret = process.env.JWT_SECRET;
  const savedService = process.env.RECIPE_MANAGER_SERVICE_TOKEN;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.RECIPE_MANAGER_SERVICE_TOKEN = SERVICE_TOKEN;
    guard = new SsoAuthGuard();
  });

  afterAll(() => {
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
    if (savedService === undefined) delete process.env.RECIPE_MANAGER_SERVICE_TOKEN;
    else process.env.RECIPE_MANAGER_SERVICE_TOKEN = savedService;
  });

  describe('rejects', () => {
    it('a request with no credential at all', () => {
      expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
    });

    it('a malformed token', () => {
      const ctx = contextFor({ headers: {}, cookies: { auth_token: 'not-a-jwt' } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('a token signed with a DIFFERENT secret', () => {
      // The distractor for "did you actually verify the signature, or just decode it?"
      // jwt.decode() would happily return the payload here and let the request through.
      const forged = sign({ email: 'attacker@example.com' }, 'some-other-secret');
      const ctx = contextFor({ headers: {}, cookies: { auth_token: forged } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('an expired token', () => {
      const expired = sign({}, SECRET, { expiresIn: '-10s' });
      const ctx = contextFor({ headers: {}, cookies: { auth_token: expired } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('a token using the "none" algorithm', () => {
      // Classic JWT downgrade. Pinning algorithms:['HS256'] is what stops it.
      const unsigned = jwt.sign({ sub: 'user-1', email: 'attacker@example.com' }, '', {
        algorithm: 'none',
      });
      const ctx = contextFor({ headers: {}, cookies: { auth_token: unsigned } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('a request when JWT_SECRET is not configured', () => {
      delete process.env.JWT_SECRET;
      const ctx = contextFor({ headers: {}, cookies: { auth_token: sign({}) } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });

  describe('accepts', () => {
    it('a valid token from the auth_token cookie, and attaches the user', () => {
      const request: Partial<RequestWithUser> = {
        headers: {},
        cookies: { auth_token: sign({ sub: 'user-42', email: 'martin@example.com' }) },
      };
      expect(guard.canActivate(contextFor(request))).toBe(true);
      expect(request.user).toEqual(
        expect.objectContaining({ id: 'user-42', email: 'martin@example.com' }),
      );
    });

    it('a valid token from an Authorization: Bearer header', () => {
      const ctx = contextFor({ headers: { authorization: `Bearer ${sign({})}` } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('a valid token when JWT_SECRET carries a trailing newline', () => {
      // Documented mhylle infra bug: the server .env historically stored the
      // secret with a trailing \n, which breaks signature verification. The
      // token is signed with the clean secret; the guard must still verify it.
      const token = sign({});
      process.env.JWT_SECRET = `${SECRET}\n`;
      const ctx = contextFor({ headers: {}, cookies: { auth_token: token } });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('service token (machine callers such as the MCP server)', () => {
    it('accepts the correct service token', () => {
      const request: Partial<RequestWithUser> = {
        headers: { 'x-service-token': SERVICE_TOKEN },
      };
      expect(guard.canActivate(contextFor(request))).toBe(true);
      expect(request.user).toEqual(expect.objectContaining({ isService: true }));
    });

    it('rejects a wrong service token', () => {
      const ctx = contextFor({ headers: { 'x-service-token': 'wrong-but-same-length-padding-xx' } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('rejects a service token that is merely a prefix of the real one', () => {
      const ctx = contextFor({ headers: { 'x-service-token': SERVICE_TOKEN.slice(0, -1) } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('rejects any service token when none is configured — never defaults to open', () => {
      // If the env var is absent, presenting an empty or any value must fail.
      // A naive `presented === process.env.X` lets `undefined === undefined` through.
      delete process.env.RECIPE_MANAGER_SERVICE_TOKEN;
      expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
      expect(() =>
        guard.canActivate(contextFor({ headers: { 'x-service-token': '' } })),
      ).toThrow(UnauthorizedException);
    });

    it('does not let a service token rescue a request whose JWT is invalid', () => {
      // A caller sending both should be judged on the credential it led with.
      const ctx = contextFor({
        headers: { 'x-service-token': SERVICE_TOKEN },
        cookies: { auth_token: sign({}, 'wrong-secret') },
      });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
