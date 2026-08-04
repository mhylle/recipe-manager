import { effect, inject } from '@angular/core';
import { LocaleService } from '../i18n';
import { PantryContextService } from './pantry-context.service';

/**
 * Run `load` now, and again whenever the language OR the kitchen changes.
 *
 * The counterpart to reloadOnLocaleChange, for views that read PER-USER data.
 * Those have two reasons to be stale: the text was fetched in another language,
 * or it was fetched for another person — signing in does not reload the page, so
 * a component that fetched once on construction keeps showing the signed-out
 * kitchen.
 *
 * Reads both signals in ONE effect, so a page never fires two requests for what
 * is really one change.
 *
 * Must be called from an injection context.
 */
export function reloadOnKitchenChange(load: () => void): void {
  const localeService = inject(LocaleService);
  const context = inject(PantryContextService);
  effect(() => {
    localeService.locale();
    context.revision();
    load();
  });
}
