import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SsoAuthGuard } from './sso-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { LocalUser } from './user.service.js';
import type { RequestWithUser } from './request-with-user.js';

/** The local identity, plus what this caller is allowed to do with it. */
export type MeResponse = LocalUser & {
  /**
   * Whether this account may add to or change the shared recipe library.
   *
   * The client needs it to decide whether to offer "add recipe" at all. Hiding
   * a button the backend would refuse is the difference between an app that
   * looks read-only and one that looks broken.
   */
  canContribute: boolean;
  /**
   * Whether this caller administers the app.
   *
   * The client needs it to decide whether to show the admin link; the routes
   * themselves are guarded independently by OwnerGuard, so this is presentation
   * only and cannot grant anything.
   */
  isOwner: boolean;
};

/**
 * The caller's LOCAL identity.
 *
 * The client needs this to decide whether it may offer edit and delete on a
 * recipe: `recipe.createdBy.id` is our User.id, while `/api/auth/validate`
 * answers with the auth-service's own id. Comparing those two would silently
 * never match, and every button would disappear for everyone.
 */
@Controller('me')
@UseGuards(SsoAuthGuard)
export class MeController {
  @Get()
  me(
    @CurrentUser() user: LocalUser,
    @Req() request: RequestWithUser,
  ): MeResponse {
    const owner = process.env.RECIPE_MANAGER_SERVICE_USER?.trim();
    return {
      ...user,
      canContribute: request.canContribute === true,
      isOwner:
        owner !== undefined && owner.length > 0 && user.ssoSubject === owner,
    };
  }
}
