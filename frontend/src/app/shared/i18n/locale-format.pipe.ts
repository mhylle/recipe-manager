import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from './locale.service';
import { bcp47Of } from './locale';

/**
 * Date, number and currency formatting that follows the active language.
 *
 * These deliberately use the platform's `Intl` rather than Angular's DatePipe /
 * DecimalPipe / CurrencyPipe. Those read `LOCALE_ID`, which Angular resolves once
 * at injector construction — a `provide: LOCALE_ID` value cannot react to a signal,
 * so number and date formatting would only follow the language after a full page
 * reload, breaking the "switching is instant" guarantee. Going through Intl with an
 * explicit tag keeps formatting reactive and needs no `registerLocaleData` (so no
 * extra locale bundles either).
 *
 * Impure for the same reason as TranslatePipe — see the note there.
 */

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Pipe({ name: 'localeDate', pure: false })
export class LocaleDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService, { optional: true });

  transform(
    value: string | number | Date | null | undefined,
    style: 'short' | 'medium' | 'long' = 'medium',
  ): string {
    const date = toDate(value);
    if (!date) {
      // Blank beats "Invalid Date" or "null" leaking into the UI.
      return '';
    }
    const options: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { dateStyle: 'short' }
        : style === 'long'
          ? { dateStyle: 'long', timeStyle: 'short' }
          : { dateStyle: 'medium' };
    return new Intl.DateTimeFormat(this.tag(), options).format(date);
  }

  private tag(): string {
    return this.locale ? bcp47Of(this.locale.locale()) : 'en-US';
  }
}

@Pipe({ name: 'localeNumber', pure: false })
export class LocaleNumberPipe implements PipeTransform {
  private readonly locale = inject(LocaleService, { optional: true });

  transform(value: number | string | null | undefined, maximumFractionDigits = 2): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) {
      return '';
    }
    const tag = this.locale ? bcp47Of(this.locale.locale()) : 'en-US';
    return new Intl.NumberFormat(tag, { maximumFractionDigits }).format(n);
  }
}

@Pipe({ name: 'localeCurrency', pure: false })
export class LocaleCurrencyPipe implements PipeTransform {
  private readonly locale = inject(LocaleService, { optional: true });

  transform(value: number | null | undefined, currency = 'DKK'): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }
    const tag = this.locale ? bcp47Of(this.locale.locale()) : 'en-US';
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
