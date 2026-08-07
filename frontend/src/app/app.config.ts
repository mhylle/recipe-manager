import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { localeInterceptor } from './shared/i18n/locale.interceptor';
import { pantryContextInterceptor } from './shared/services/pantry-context.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([localeInterceptor, pantryContextInterceptor]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Wait for the app to settle before registering, so the worker never
      // competes with the first paint on a phone.
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
