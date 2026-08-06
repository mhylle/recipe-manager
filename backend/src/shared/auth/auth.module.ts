import { Global, Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { SsoAuthGuard } from './sso-auth.guard.js';
import { ContributorGuard } from './contributor.guard.js';
import { MeController } from './me.controller.js';

/**
 * Global so `@UseGuards(SsoAuthGuard)` resolves anywhere without every feature
 * module importing it. The guard now has a dependency (UserService), so it can
 * no longer be instantiated as a bare class the way a stateless guard could.
 */
@Global()
@Module({
  controllers: [MeController],
  providers: [UserService, SsoAuthGuard, ContributorGuard],
  exports: [UserService, SsoAuthGuard, ContributorGuard],
})
export class AuthModule {}
