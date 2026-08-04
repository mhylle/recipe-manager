import { Controller, Get, UseGuards } from '@nestjs/common';
import { SsoAuthGuard } from './sso-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { LocalUser } from './user.service.js';

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
  me(@CurrentUser() user: LocalUser): LocalUser {
    return user;
  }
}
