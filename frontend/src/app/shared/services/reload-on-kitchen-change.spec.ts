import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { reloadOnKitchenChange } from './reload-on-kitchen-change';
import { PantryContextService } from './pantry-context.service';
import { LocaleService } from '../i18n';

/** Counts how many times a kitchen-scoped view would have re-fetched. */
@Component({ selector: 'app-probe', template: '' })
class ProbeComponent {
  loads = 0;
  readonly context = inject(PantryContextService);
  private readonly reload = reloadOnKitchenChange(() => this.loads++);
}

describe('reloadOnKitchenChange', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ProbeComponent>>;
  let probe: ProbeComponent;
  let httpTesting: HttpTestingController;
  let locale: LocaleService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProbeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ProbeComponent);
    probe = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    locale = TestBed.inject(LocaleService);
    fixture.detectChanges();
  });

  it('loads once on creation', () => {
    expect(probe.loads).toBe(1);
  });

  it('RE-LOADS when the kitchen is resolved again after signing in', () => {
    // The bug this exists to prevent: signing in does not reload the page, so a
    // view that fetched once on construction kept showing the signed-out
    // kitchen until a manual refresh.
    probe.context.load();
    httpTesting.expectOne((r) => r.url.endsWith('/mine')).flush([
      { id: 'p1', name: 'Hjemme', role: 'owner', isOwner: true, memberCount: 1 },
    ]);
    fixture.detectChanges();

    expect(probe.loads).toBe(2);
  });

  it('reloads when a different kitchen is selected', () => {
    probe.context.pantries.set([
      { id: 'p1', name: 'Hjemme', role: 'owner', isOwner: true, memberCount: 1 },
      { id: 'p2', name: 'Sommerhus', role: 'owner', isOwner: true, memberCount: 1 },
    ]);
    probe.context.currentId.set('p1');
    const before = probe.loads;

    probe.context.select('p2');
    fixture.detectChanges();

    expect(probe.loads).toBe(before + 1);
  });

  it('does NOT reload when the same kitchen is selected again', () => {
    // Re-picking the current one is not a change, and re-fetching on every
    // click of the switcher would be a request per keystroke on a select.
    probe.context.currentId.set('p1');
    const before = probe.loads;

    probe.context.select('p1');
    fixture.detectChanges();

    expect(probe.loads).toBe(before);
  });

  it('reloads EXACTLY once when the language changes', () => {
    // Locale and kitchen are read in a single effect on purpose. Two separate
    // effects would double every fetch on a page that cares about both, so the
    // assertion is +1 and not merely "more than before".
    const before = probe.loads;
    locale.setLocale('da');
    fixture.detectChanges();
    expect(probe.loads).toBe(before + 1);
  });

  it('does not reload when the language is set to what it already was', () => {
    locale.setLocale('da');
    fixture.detectChanges();
    const before = probe.loads;

    locale.setLocale('da');
    fixture.detectChanges();

    expect(probe.loads).toBe(before);
  });

  it('still reloads when resolving the kitchen FAILS', () => {
    // A sign-out 401s. The page must re-fetch to discover it is signed out,
    // rather than keeping the previous person's data on screen.
    const before = probe.loads;
    probe.context.load();
    httpTesting
      .expectOne((r) => r.url.endsWith('/mine'))
      .flush('', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(probe.loads).toBe(before + 1);
  });
});
