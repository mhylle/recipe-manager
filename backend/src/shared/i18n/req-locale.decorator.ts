import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Locale, resolveLocale } from './locale.js';

/**
 * Resolves the request's content language from `Accept-Language`.
 *
 * Usage: `findAll(@ReqLocale() locale: Locale)`.
 *
 * Always yields a supported locale — a missing or unparseable header falls back to
 * the default rather than failing the request.
 */
export const ReqLocale = createParamDecorator((_data: unknown, ctx: ExecutionContext): Locale => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
  return resolveLocale(request.headers['accept-language']);
});
