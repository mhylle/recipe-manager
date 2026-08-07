import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportsPageComponent } from './reports-page';
import type { Report } from '../reports.service';

const report = (over: Partial<Report> = {}): Report => ({
  id: 'r-1',
  kind: 'defect',
  title: 'Timers do not ring',
  description: 'Locked the phone and nothing happened.',
  pagePath: '/recipes/abc',
  createdAt: '2026-08-07T00:00:00.000Z',
  reporterName: 'A Cook',
  githubIssueUrl: 'https://github.com/mhylle/recipe-manager/issues/42',
  githubIssueNumber: 42,
  githubError: null,
  githubState: 'open',
  ...over,
});

describe('ReportsPageComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ReportsPageComponent>>;
  let component: ReportsPageComponent;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ReportsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ReportsPageComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);

    // checkAuth() from the constructor.
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ success: true, data: { email: 'cook@example.com' } });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/me'))
      .flush({ id: 'local-1', canContribute: true, isOwner: false });
  });

  afterEach(() => httpTesting.verify());

  const expectAllRequest = () =>
    httpTesting.expectOne((r) => r.url.endsWith('/api/reports') && r.method === 'GET');
  const expectMineRequest = () =>
    httpTesting.expectOne((r) => r.url.endsWith('/api/reports/mine') && r.method === 'GET');

  describe('who sees what', () => {
    it('shows everything when the caller may', () => {
      expectAllRequest().flush([report(), report({ id: 'r-2', reporterName: 'Someone Else' })]);

      expect(component.showingAll()).toBe(true);
      expect(component.items()).toHaveLength(2);
    });

    it('falls back to your own when the full list is refused', () => {
      // Whether someone is the owner is only known once /api/me answers; asking
      // and falling back avoids sequencing that, at the cost of one request.
      expectAllRequest().flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });
      expectMineRequest().flush([report()]);

      expect(component.showingAll()).toBe(false);
      expect(component.items()).toHaveLength(1);
    });

    it('reports a real failure rather than showing an empty list', () => {
      expectAllRequest().flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });
      expectMineRequest().flush({ message: 'boom' }, { status: 500, statusText: 'Error' });

      expect(component.failed()).toBe(true);
      expect(component.loading()).toBe(false);
    });
  });

  describe('status', () => {
    it('shows open and done from GitHub', () => {
      expectAllRequest().flush([
        report({ id: 'r-1', githubState: 'open' }),
        report({ id: 'r-2', githubState: 'closed' }),
      ]);

      expect(component.statusKey(component.items()[0])).toBe('reports.statusOpen');
      expect(component.statusKey(component.items()[1])).toBe('reports.statusClosed');
    });

    it('says unknown rather than guessing when GitHub had no answer', () => {
      // A closed request shown as open is worse than no badge.
      expectAllRequest().flush([report({ githubState: null })]);
      expect(component.statusKey(component.items()[0])).toBe('reports.statusUnknown');
    });

    it('distinguishes "never filed" from "status unknown"', () => {
      expectAllRequest().flush([
        report({ githubIssueNumber: null, githubIssueUrl: null, githubState: null }),
      ]);
      expect(component.statusKey(component.items()[0])).toBe('reports.statusNotFiled');
    });

    it('counts only what is still open', () => {
      expectAllRequest().flush([
        report({ id: 'r-1', githubState: 'open' }),
        report({ id: 'r-2', githubState: 'closed' }),
        report({ id: 'r-3', githubState: null }),
      ]);

      expect(component.openCount()).toBe(1);
    });
  });
});
