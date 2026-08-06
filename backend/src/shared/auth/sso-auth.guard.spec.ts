import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SsoAuthGuard } from './sso-auth.guard.js';
import type { RequestWithUser } from './request-with-user.js';
import type { UserService, SsoClaims } from './user.service.js';
import type { McpKeyService } from '../../profile/mcp-key.service.js';

/**
 * Stands in for the directory. The guard's job is deciding WHETHER a caller is
 * authentic and handing on the claims; turning claims into a row is
 * UserService's job and is tested in its own spec.
 */
function fakeUsers() {
  return {
    resolveFromClaims: jest.fn((claims: SsoClaims) =>
      Promise.resolve({
        id: `local-${claims.sub}`,
        ssoSubject: claims.sub,
        email: claims.email,
        displayName: claims.name ?? claims.email,
      }),
    ),
    // The MCP-key path resolves the local row directly, having no claims.
    findById: jest.fn((id: string) =>
      Promise.resolve({
        id,
        ssoSubject: `subject-for-${id}`,
        email: 'cook@example.com',
        displayName: 'A Cook',
      }),
    ),
    resolveServiceUser: jest.fn(() =>
      Promise.resolve({
        id: 'local-service',
        ssoSubject: 'service-subject',
        email: 'mhylle@yahoo.com',
        displayName: 'Martin Hylleberg',
      }),
    ),
  };
}

const SECRET = 'test-jwt-secret-value-for-unit-tests';
const SERVICE_TOKEN = 'service-token-with-at-least-32-characters-of-entropy';

function contextFor(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request as RequestWithUser }),
  } as ExecutionContext;
}

function sign(
  payload: Record<string, unknown>,
  secret = SECRET,
  options: jwt.SignOptions = {},
) {
  return jwt.sign(
    { sub: 'user-1', email: 'someone@example.com', ...payload },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      ...options,
    },
  );
}

/**
 * Personal MCP keys the guard can resolve. `rmk_granted` belongs to someone with
 * the contribution grant, `rmk_plain` to someone without it.
 */
function fakeMcpKeys() {
  return {
    resolve: jest.fn((token: string) => {
      if (token === 'rmk_granted') {
        return Promise.resolve({ userId: 'local-mcp', canContribute: true });
      }
      if (token === 'rmk_plain') {
        return Promise.resolve({ userId: 'local-mcp', canContribute: false });
      }
      return Promise.resolve(null);
    }),
  };
}

describe('SsoAuthGuard', () => {
  let guard: SsoAuthGuard;
  let users: ReturnType<typeof fakeUsers>;
  let mcpKeys: ReturnType<typeof fakeMcpKeys>;
  const savedSecret = process.env.JWT_SECRET;
  const savedService = process.env.RECIPE_MANAGER_SERVICE_TOKEN;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.RECIPE_MANAGER_SERVICE_TOKEN = SERVICE_TOKEN;
    users = fakeUsers();
    mcpKeys = fakeMcpKeys();
    guard = new SsoAuthGuard(
      users as unknown as UserService,
      mcpKeys as unknown as McpKeyService,
    );
  });

  afterAll(() => {
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
    if (savedService === undefined)
      delete process.env.RECIPE_MANAGER_SERVICE_TOKEN;
    else process.env.RECIPE_MANAGER_SERVICE_TOKEN = savedService;
  });

  describe('rejects', () => {
    it('a request with no credential at all', async () => {
      await expect(
        guard.canActivate(contextFor({ headers: {} })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('a malformed token', async () => {
      const ctx = contextFor({
        headers: {},
        cookies: { auth_token: 'not-a-jwt' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('a token signed with a DIFFERENT secret', async () => {
      // The distractor for "did you actually verify the signature, or just decode it?"
      // jwt.decode() would happily return the payload here and let the request through.
      const forged = sign(
        { email: 'attacker@example.com' },
        'some-other-secret',
      );
      const ctx = contextFor({ headers: {}, cookies: { auth_token: forged } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('an expired token', async () => {
      const expired = sign({}, SECRET, { expiresIn: '-10s' });
      const ctx = contextFor({ headers: {}, cookies: { auth_token: expired } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('a token using the "none" algorithm', async () => {
      // Classic JWT downgrade. Pinning algorithms:['HS256'] is what stops it.
      const unsigned = jwt.sign(
        { sub: 'user-1', email: 'attacker@example.com' },
        '',
        {
          algorithm: 'none',
        },
      );
      const ctx = contextFor({
        headers: {},
        cookies: { auth_token: unsigned },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('a request when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;
      const ctx = contextFor({
        headers: {},
        cookies: { auth_token: sign({}) },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('accepts', () => {
    it('a valid token from the auth_token cookie, and attaches the user', async () => {
      const request: Partial<RequestWithUser> = {
        headers: {},
        cookies: {
          auth_token: sign({ sub: 'user-42', email: 'martin@example.com' }),
        },
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      // The attached user is a LOCAL row, not the raw claims. `id` is ours and
      // `ssoSubject` carries the token's `sub` — conflating the two would make
      // every foreign key in the app point at an external system's identifier.
      expect(request.user).toEqual({
        id: 'local-user-42',
        ssoSubject: 'user-42',
        email: 'martin@example.com',
        displayName: 'martin@example.com',
      });
      expect(request.user!.id).not.toBe(request.user!.ssoSubject);
    });

    it('a valid token from an Authorization: Bearer header', async () => {
      const ctx = contextFor({
        headers: { authorization: `Bearer ${sign({})}` },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('a valid token when JWT_SECRET carries a trailing newline', async () => {
      // Documented mhylle infra bug: the server .env historically stored the
      // secret with a trailing \n, which breaks signature verification. The
      // token is signed with the clean secret; the guard must still verify it.
      const token = sign({});
      process.env.JWT_SECRET = `${SECRET}\n`;
      const ctx = contextFor({ headers: {}, cookies: { auth_token: token } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('service token (machine callers such as the MCP server)', () => {
    it('accepts the correct service token', async () => {
      const request: Partial<RequestWithUser> = {
        headers: { 'x-service-token': SERVICE_TOKEN },
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      // A machine caller acts AS somebody — it resolves to the configured
      // service user, not to an anonymous "is a service" marker.
      expect(request.user).toEqual(
        expect.objectContaining({ displayName: 'Martin Hylleberg' }),
      );
      expect(request.isServiceCaller).toBe(true);
      // The MCP server's whole purpose includes adding recipes, and it has no
      // `apps` claim to consult. Losing this would 403 every one of its write
      // tools with a message about a grant that cannot be given to a machine.
      expect(request.canContribute).toBe(true);
    });

    it('rejects a wrong service token', async () => {
      const ctx = contextFor({
        headers: { 'x-service-token': 'wrong-but-same-length-padding-xx' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a service token that is merely a prefix of the real one', async () => {
      const ctx = contextFor({
        headers: { 'x-service-token': SERVICE_TOKEN.slice(0, -1) },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects any service token when none is configured — never defaults to open', async () => {
      // If the env var is absent, presenting an empty or any value must fail.
      // A naive `presented === process.env.X` lets `undefined === undefined` through.
      delete process.env.RECIPE_MANAGER_SERVICE_TOKEN;
      await expect(
        guard.canActivate(contextFor({ headers: {} })),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        guard.canActivate(contextFor({ headers: { 'x-service-token': '' } })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not let a service token rescue a request whose JWT is invalid', async () => {
      // A caller sending both should be judged on the credential it led with.
      const ctx = contextFor({
        headers: { 'x-service-token': SERVICE_TOKEN },
        cookies: { auth_token: sign({}, 'wrong-secret') },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  /**
   * The `apps` grant, read fresh from every token.
   *
   * Authentication and contribution rights are deliberately separate here: a
   * self-registered cook must be able to sign in and run their own kitchen while
   * being unable to write to the shared recipe library.
   */
  describe('contribution grant', () => {
    it('grants contribution when the token carries this app', async () => {
      const request: Partial<RequestWithUser> = {
        cookies: { auth_token: sign({ apps: ['games', 'recipe-manager'] }) },
        headers: {},
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.canContribute).toBe(true);
    });

    it('authenticates but withholds contribution for the default grant', async () => {
      // What a brand-new account actually comes back with: apps: ["games"].
      const request: Partial<RequestWithUser> = {
        cookies: { auth_token: sign({ apps: ['games'] }) },
        headers: {},
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      // Signed in — the kitchen must still work.
      expect(request.user).toBeDefined();
      expect(request.canContribute).toBe(false);
    });

    it('withholds contribution when the claim is absent altogether', async () => {
      const request: Partial<RequestWithUser> = {
        cookies: { auth_token: sign({}) },
        headers: {},
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.canContribute).toBe(false);
    });

    it('is not fooled by a claim that is not an array', async () => {
      const request: Partial<RequestWithUser> = {
        cookies: { auth_token: sign({ apps: 'recipe-manager' }) },
        headers: {},
      };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.canContribute).toBe(false);
    });
  });
});

/**
 * Personal MCP keys.
 *
 * The point of them: an assistant's writes are attributed to the person whose key
 * it is, and the contribution gate applies to that person — rather than every MCP
 * write looking like the owner's, which is what the shared token did.
 */
describe('SsoAuthGuard — personal MCP keys', () => {
  let guard: SsoAuthGuard;
  let users: ReturnType<typeof fakeUsers>;
  let mcpKeys: ReturnType<typeof fakeMcpKeys>;

  beforeEach(() => {
    users = fakeUsers();
    mcpKeys = fakeMcpKeys();
    guard = new SsoAuthGuard(
      users as unknown as UserService,
      mcpKeys as unknown as McpKeyService,
    );
  });

  it('resolves a valid key to its owner', async () => {
    const request: Partial<RequestWithUser> = {
      headers: { 'x-mcp-key': 'rmk_granted' },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user?.id).toBe('local-mcp');
    expect(request.canContribute).toBe(true);
  });

  it('carries the owner\u2019s grant, not a blanket one', async () => {
    const request: Partial<RequestWithUser> = {
      headers: { 'x-mcp-key': 'rmk_plain' },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    // Authenticated, but cannot write to the shared library.
    expect(request.user?.id).toBe('local-mcp');
    expect(request.canContribute).toBe(false);
  });

  it('rejects an unknown or revoked key', async () => {
    await expect(
      guard.canActivate(
        contextFor({ headers: { 'x-mcp-key': 'rmk_revoked' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('is preferred over the shared service token', async () => {
    // A caller presenting both should be judged on their own credential, so the
    // write is attributed to them rather than to the service user.
    process.env.RECIPE_MANAGER_SERVICE_TOKEN = SERVICE_TOKEN;
    const request: Partial<RequestWithUser> = {
      headers: { 'x-mcp-key': 'rmk_granted', 'x-service-token': SERVICE_TOKEN },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user?.id).toBe('local-mcp');
    expect(users.resolveServiceUser).not.toHaveBeenCalled();
  });
});
