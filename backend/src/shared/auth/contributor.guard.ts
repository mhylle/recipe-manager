import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestWithUser } from './request-with-user.js';
import { APP_NAME } from './app-access.js';

/**
 * Guards writes to the SHARED recipe library.
 *
 * Anyone with a valid mhylle.com account may sign in, browse every recipe and
 * run their own kitchen. Adding to or altering the library that everyone sees is
 * the one thing that needs a deliberate grant, which is what makes open
 * self-registration safe: a stranger can register and be immediately useful to
 * themselves without being able to write into the family's cookbook.
 *
 * Always mounted AFTER SsoAuthGuard — `@UseGuards(SsoAuthGuard,
 * ContributorGuard)` — because it reads what that guard put on the request.
 */
@Injectable()
export class ContributorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // Undefined means SsoAuthGuard did not run, which is a wiring mistake
    // rather than a permission failure. Reporting it as 403 would send someone
    // looking at grants for a route that never authenticated anyone.
    if (request.canContribute === undefined) {
      throw new InternalServerErrorException(
        'ContributorGuard used on a route with no SsoAuthGuard.',
      );
    }

    if (!request.canContribute) {
      throw new ForbiddenException(
        `Your account has not been granted access to ${APP_NAME}, so it cannot add or change shared recipes.`,
      );
    }
    return true;
  }
}
