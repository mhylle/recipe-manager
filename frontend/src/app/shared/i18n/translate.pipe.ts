import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService, TranslateParams } from './locale.service';
import type { TranslationKey } from './en';

/**
 * Translates a key into the active language: `{{ 'recipes.title' | t }}`.
 *
 * Typing the key as `TranslationKey` means `strictTemplates` rejects a typo or a
 * key that only exists in one dictionary — at build time, in the template.
 *
 * Deliberately IMPURE. A pure pipe memoises on its inputs, and the input here is a
 * constant string literal; when the language changes the key has not, so a pure
 * pipe would keep serving the previous language's text until something unrelated
 * happened to re-render the view. Impure keeps the "switch is instant" guarantee.
 * The work per call is one object lookup, and every component in this app is
 * OnPush, so change detection is already infrequent.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(key: TranslationKey, params?: TranslateParams): string {
    return this.locale.translate(key, params);
  }
}
