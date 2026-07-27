import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LanguageSwitcherComponent } from './language-switcher';
import { LocaleService } from '../locale.service';
import { LOCALE_STORAGE_KEY } from '../locale';

describe('LanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let select: HTMLSelectElement;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    select = fixture.nativeElement.querySelector('select');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('offers every registered language', () => {
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['en', 'da']);
  });

  it('labels each language with its own endonym, not a translation', () => {
    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['English', 'Dansk']);
  });

  it('has an accessible label', () => {
    expect(select.getAttribute('aria-label')).toBe('Language');
  });

  it('preselects the active language', () => {
    expect(select.value).toBe('en');
  });

  it('switches and persists the language on selection', () => {
    select.value = 'da';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(TestBed.inject(LocaleService).locale()).toBe('da');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('da');
    // Its own label follows the switch.
    expect(select.getAttribute('aria-label')).toBe('Sprog');
  });

  it('ignores a value that is not a supported language', () => {
    const service = TestBed.inject(LocaleService);
    select.insertAdjacentHTML('beforeend', '<option value="klingon">Klingon</option>');
    select.value = 'klingon';
    select.dispatchEvent(new Event('change'));

    expect(service.locale()).toBe('en');
  });
});
