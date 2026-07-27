import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LocaleService } from './locale.service';
import { bcp47Of } from './locale';

/**
 * Tags every same-origin API request with the active UI language.
 *
 * `Accept-Language` is the standard mechanism, so it costs nothing today and is
 * exactly what the backend will read once content is stored per locale (phase L5).
 * Wiring it now means L5/L6 need no frontend rework — which was the whole reason
 * for splitting the UI and content halves of this feature.
 *
 * Backends serving per-locale content from this must send `Vary: Accept-Language`
 * so caches do not hand a Danish response to an English reader.
 */
export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  // Third parties (e.g. BilkaToGo) have no business receiving our UI locale, and
  // an unexpected header can trip CORS preflight.
  const isSameOrigin = !/^https?:\/\//i.test(req.url);
  if (!isSameOrigin) {
    return next(req);
  }

  // A caller that set the header deliberately outranks the ambient UI locale.
  if (req.headers.has('Accept-Language')) {
    return next(req);
  }

  const locale = inject(LocaleService);
  return next(req.clone({ setHeaders: { 'Accept-Language': bcp47Of(locale.locale()) } }));
};
