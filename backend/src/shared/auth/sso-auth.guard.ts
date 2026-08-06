import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { RequestWithUser } from './request-with-user.js';
import { UserService, type SsoClaims } from './user.service.js';
import { grantsAppAccess } from './app-access.js';
import { McpKeyService } from './mcp-key.service.js';

/** Claims minted by the central mhylle auth-service (HS256). */
interface JwtCookiePayload {
  sub: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  apps?: string[];
}

/**
 * The identity half of a token, which is all UserService needs.
 *
 * Kept separate from the grant half deliberately: identity is persisted to a
 * local row, whereas `apps` is authorisation that must be re-read from every
 * token rather than stored.
 */
function claimsOf(payload: JwtCookiePayload): SsoClaims {
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}

/**
 * Guards writes behind the shared mhylle SSO session.
 *
 * Two ways in, and they are deliberately different things:
 *
 * 1. **A person** — the `auth_token` cookie (or a bearer JWT) issued by the
 *    auth-service, verified HS256 against JWT_SECRET.
 * 2. **A machine** — `X-Service-Token`, used by the MCP server, whose write
 *    tools would otherwise stop working the moment writes were guarded.
 *
 * The service token is a *separate*, recipe-manager-scoped secret rather than a
 * JWT the MCP server mints itself. Minting would mean handing JWT_SECRET to a
 * publicly reachable container, and that key signs tokens for every app in the
 * estate — a compromise there would become a compromise of all of them. A
 * scoped token keeps the blast radius inside this one app.
 */
@Injectable()
export class SsoAuthGuard implements CanActivate {
  constructor(
    private readonly users: UserService,
    private readonly mcpKeys: McpKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const jwtToken = this.extractJwt(request);
    if (jwtToken) {
      const payload = this.verifyJwt(jwtToken);
      // Resolving to a local row is what lets everything downstream hold a
      // foreign key to a person, and it provisions on first sight.
      // Read from the token on every request. The copy written to the user row
      // is only for credentials that carry no token at all.
      const canContribute = grantsAppAccess(payload.apps);
      request.user = await this.users.resolveFromClaims(
        claimsOf(payload),
        canContribute,
      );
      request.canContribute = canContribute;
      return true;
    }

    // A personal MCP credential. Checked before the shared service token so a
    // user's own key wins, and so writes are attributed to them rather than to
    // whoever RECIPE_MANAGER_SERVICE_USER happens to be.
    const mcpKey = request.headers['x-mcp-key'];
    if (typeof mcpKey === 'string' && mcpKey.length > 0) {
      const resolved = await this.mcpKeys.resolve(mcpKey);
      if (!resolved) {
        throw new UnauthorizedException('Invalid or revoked MCP key');
      }
      const user = await this.users.findById(resolved.userId);
      if (!user) {
        throw new UnauthorizedException('MCP key belongs to no known user');
      }
      request.user = user;
      request.canContribute = resolved.canContribute;
      return true;
    }

    const serviceToken = request.headers['x-service-token'];
    if (typeof serviceToken === 'string' && serviceToken.length > 0) {
      if (!this.serviceTokenMatches(serviceToken)) {
        throw new UnauthorizedException('Invalid service token');
      }
      // A machine caller still acts AS somebody. Unattributed writes create
      // rows nothing can later reach.
      request.user = await this.users.resolveServiceUser();
      request.isServiceCaller = true;
      // The service token is a deliberately-issued credential for this app, so
      // it carries contribution rights by definition — there is no `apps` claim
      // to consult, and the MCP server's write tools exist to add recipes.
      request.canContribute = true;
      return true;
    }

    throw new UnauthorizedException('Missing authentication token');
  }

  private extractJwt(request: RequestWithUser): string | undefined {
    const cookieToken = request.cookies?.['auth_token'] as unknown;
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      return cookieToken;
    }
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return undefined;
  }

  private verifyJwt(token: string): JwtCookiePayload {
    // .trim() defends against a trailing newline in JWT_SECRET — a documented
    // mhylle infra bug that silently breaks signature verification.
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    let payload: JwtCookiePayload;
    try {
      // Algorithms are pinned: without this, a token with alg "none" verifies.
      payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as JwtCookiePayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return payload;
  }

  private serviceTokenMatches(presented: string): boolean {
    const expected = process.env.RECIPE_MANAGER_SERVICE_TOKEN;
    // No token configured means no service access — never "everything matches".
    if (!expected) {
      return false;
    }
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on a length mismatch, which would itself leak the
    // length. Compare against a same-length buffer and AND in the length check,
    // so every path does the same work.
    const sameLength = a.length === b.length;
    const left = sameLength ? a : Buffer.alloc(b.length);
    return timingSafeEqual(left, b) && sameLength;
  }
}
