import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranslatePipe } from './translate.pipe';
import { LocaleService } from './locale.service';

@Component({
  selector: 'app-translate-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <span class="plain">{{ 'language.switcher.label' | t }}</span>
    <span class="param">{{ 'common.actions.deleteNamed' | t: { name: 'Guacamole' } }}</span>
  `,
})
class TranslateHostComponent {
  readonly locale = inject(LocaleService);
}

describe('TranslatePipe', () => {
  let fixture: ComponentFixture<TranslateHostComponent>;

  const textOf = (selector: string): string =>
    fixture.nativeElement.querySelector(selector).textContent.trim();

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');

    await TestBed.configureTestingModule({
      imports: [TranslateHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TranslateHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the active language', () => {
    expect(textOf('.plain')).toBe('Language');
  });

  it('interpolates parameters', () => {
    expect(textOf('.param')).toBe('Delete Guacamole');
  });

  it('re-renders immediately when the locale changes, with no reload', () => {
    // This is the criterion an ordinary pure pipe would silently fail: the bound
    // key never changes, so a memoising pipe would keep serving the English value.
    fixture.componentInstance.locale.setLocale('da');
    fixture.detectChanges();

    expect(textOf('.plain')).toBe('Sprog');
    expect(textOf('.param')).toBe('Slet Guacamole');
  });
});
