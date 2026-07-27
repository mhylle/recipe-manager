import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocaleDatePipe, LocaleNumberPipe, LocaleCurrencyPipe } from './locale-format.pipe';
import { LocaleService } from './locale.service';

@Component({
  selector: 'app-format-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocaleDatePipe, LocaleNumberPipe, LocaleCurrencyPipe],
  template: `
    <span class="num">{{ 1.5 | localeNumber }}</span>
    <span class="date">{{ '2026-03-19T10:00:00.000Z' | localeDate }}</span>
    <span class="money">{{ 24.95 | localeCurrency: 'DKK' }}</span>
  `,
})
class FormatHostComponent {
  readonly locale = inject(LocaleService);
}

describe('locale-aware formatting pipes', () => {
  let fixture: ComponentFixture<FormatHostComponent>;
  const textOf = (s: string): string => fixture.nativeElement.querySelector(s).textContent.trim();

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
    await TestBed.configureTestingModule({ imports: [FormatHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(FormatHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('uses a decimal POINT in English', () => {
    expect(textOf('.num')).toBe('1.5');
  });

  it('uses a decimal COMMA in Danish', () => {
    // The whole point of the phase: 1.5 dl is "1,5 dl" to a Danish reader.
    fixture.componentInstance.locale.setLocale('da');
    fixture.detectChanges();
    expect(textOf('.num')).toBe('1,5');
  });

  it('reformats dates when the locale changes, with no reload', () => {
    const english = textOf('.date');
    fixture.componentInstance.locale.setLocale('da');
    fixture.detectChanges();
    const danish = textOf('.date');

    // en-US puts the month first, da-DK the day. Assert they differ rather than
    // pinning exact ICU output, which varies by Node/ICU build.
    expect(danish).not.toBe(english);
    expect(english).toMatch(/3.*19|Mar/);
    expect(danish).toMatch(/19/);
  });

  it('formats currency per locale', () => {
    const english = textOf('.money');
    fixture.componentInstance.locale.setLocale('da');
    fixture.detectChanges();
    const danish = textOf('.money');

    expect(english).toContain('24.95');
    expect(danish).toContain('24,95');
  });

  it('renders empty for null/undefined instead of "null" or "NaN"', () => {
    // Pipes call inject(), so they must be constructed inside an injection context.
    TestBed.runInInjectionContext(() => {
      const datePipe = new LocaleDatePipe();
      const numPipe = new LocaleNumberPipe();
      expect(datePipe.transform(null)).toBe('');
      expect(datePipe.transform(undefined)).toBe('');
      expect(numPipe.transform(null)).toBe('');
      expect(numPipe.transform(undefined)).toBe('');
    });
  });

  it('renders an unparseable date as empty rather than "Invalid Date"', () => {
    TestBed.runInInjectionContext(() => {
      expect(new LocaleDatePipe().transform('not-a-date')).toBe('');
    });
  });
});
