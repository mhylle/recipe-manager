import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestWithUser } from './request-with-user.js';
import type { LocalUser } from './user.service.js';

/**
 * The authenticated caller, resolved to a local row by SsoAuthGuard.
 *
 * Controllers take the user from here and never from the request body or a
 * query parameter — a client-supplied user id is an authorisation hole, not an
 * input.
 *
 * Throws rather than returning undefined if the guard did not run: a handler
 * asking for a user on an unguarded route is a wiring mistake, and silently
 * handing it `undefined` would push the failure into whatever it does next.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): LocalUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route with no SsoAuthGuard.',
      );
    }
    return request.user;
  },
);
