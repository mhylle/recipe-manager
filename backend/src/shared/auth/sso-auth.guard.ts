import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { AuthUser, RequestWithUser } from './request-with-user.js';

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
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const jwtToken = this.extractJwt(request);
    if (jwtToken) {
      request.user = this.verifyJwt(jwtToken);
      return true;
    }

    const serviceToken = request.headers['x-service-token'];
    if (typeof serviceToken === 'string' && serviceToken.length > 0) {
      if (!this.serviceTokenMatches(serviceToken)) {
        throw new UnauthorizedException('Invalid service token');
      }
      request.user = { isService: true };
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

  private verifyJwt(token: string): AuthUser {
    // .trim() defends against a trailing newline in JWT_SECRET — a documented
    // mhylle infra bug that silently breaks signature verification.
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    let payload: JwtCookiePayload;
    try {
      // Algorithms are pinned: without this, a token with alg "none" verifies.
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtCookiePayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const composed = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? (composed.length > 0 ? composed : payload.email),
      apps: payload.apps,
    };
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
