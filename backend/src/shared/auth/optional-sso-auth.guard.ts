import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SsoAuthGuard } from './sso-auth.guard.js';

/**
 * Authentication for routes that are readable by everyone but answer
 * differently once they know who is asking.
 *
 * The recipe list is the case this exists for. It has always been open — guests
 * browse the library without an account, and that must keep working — but a
 * private recipe can only be filtered out if the read knows whose it might be.
 * A hard guard would take browsing away from guests; no guard at all would make
 * every caller anonymous and hide people's own recipes from them.
 *
 * Bad credentials are treated as no credentials on purpose. A stale cookie
 * should degrade to the public library rather than 401 a page that needs no
 * login. Anything that is *not* an auth failure — a database outage while
 * resolving the user, say — still propagates: that is a broken request, not an
 * anonymous one, and serving it as a short list would pass off an error as a
 * normal answer.
 */
@Injectable()
export class OptionalSsoAuthGuard extends SsoAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch (error: unknown) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }
      // Guest. `request.user` is left unset, and the read filters to public.
    }
    return true;
  }
}
