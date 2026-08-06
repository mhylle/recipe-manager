import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestWithUser } from './request-with-user.js';

/**
 * The one person who administers this app.
 *
 * Identified by `RECIPE_MANAGER_SERVICE_USER` — the SSO subject already
 * configured as the identity machine writes are attributed to, which is the
 * owner's. Reusing it avoids inventing a second notion of "who runs this",
 * and there is no route that lets anyone appoint themselves.
 *
 * Deliberately not driven by the JWT's `roles` claim: there is no
 * `recipe-manager` role in the estate, so reading roles would either match
 * nothing or require granting one — which is the manual auth-service step this
 * whole admin page exists to avoid.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new InternalServerErrorException(
        'OwnerGuard used on a route with no SsoAuthGuard.',
      );
    }

    const owner = process.env.RECIPE_MANAGER_SERVICE_USER?.trim();
    // Unconfigured means nobody is the owner, never everybody. An admin page
    // that opens up when an env var goes missing is the worst kind of failure.
    if (!owner) {
      throw new ForbiddenException(
        'No administrator is configured for this app.',
      );
    }

    if (request.user.ssoSubject !== owner) {
      throw new ForbiddenException('Only the owner may administer access.');
    }
    return true;
  }
}
