import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { LocaleService } from '../locale.service';
import { TranslatePipe } from '../translate.pipe';
import { LOCALES, isLocale } from '../locale';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss',
})
export class LanguageSwitcherComponent {
  protected readonly localeService = inject(LocaleService);

  /**
   * Rendered with each language's own endonym ("Dansk", not "Danish") and never
   * translated — someone looking for their language needs to recognise it while
   * the UI is still in a language they cannot read.
   */
  protected readonly locales = LOCALES;

  protected onSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isLocale(value)) {
      this.localeService.setLocale(value);
    }
  }
}
