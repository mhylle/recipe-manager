import { effect, inject } from '@angular/core';
import { LocaleService } from './locale.service';

/**
 * Run `load` now and again whenever the language changes.
 *
 * Content from the API is localised server-side, so a view that fetched once in
 * `ngOnInit` keeps showing the language it was fetched in — the switcher changes
 * the chrome around stale text. Components that render API-supplied prose call
 * this INSTEAD of fetching in `ngOnInit`.
 *
 * Must be called from an injection context (a field initialiser or constructor).
 */
export function reloadOnLocaleChange(load: () => void): void {
  const localeService = inject(LocaleService);
  effect(() => {
    // Read the signal so the effect re-runs on every switch.
    localeService.locale();
    load();
  });
}
