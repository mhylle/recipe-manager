import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportDialogComponent } from './report-dialog';
import type { Report } from '../../../features/reports/reports.service';

const saved = (over: Partial<Report> = {}): Report => ({
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
  ...over,
});

describe('ReportDialogComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ReportDialogComponent>>;
  let component: ReportDialogComponent;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ReportDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(ReportDialogComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  const fill = () => {
    component.title = 'Timers do not ring';
    component.description = 'Locked the phone and nothing happened.';
  };

  it('requires both fields before sending anything', () => {
    component.title = 'Only a title';
    component.submit();

    expect(component.errorKey()).toBe('report.errRequired');
    httpTesting.expectNone((r) => r.method === 'POST');
  });

  it('sends the report with the kind and the current page', () => {
    fill();
    component.kind = 'improvement';
    component.submit();

    const req = httpTesting.expectOne((r) => r.url.endsWith('/api/reports'));
    expect(req.request.body).toMatchObject({
      kind: 'improvement',
      title: 'Timers do not ring',
      description: 'Locked the phone and nothing happened.',
      // Saves a round trip of "where did you see this?".
      pagePath: TestBed.inject(Router).url,
    });
    req.flush(saved({ kind: 'improvement' }));
  });

  it('trims the text it sends', () => {
    component.title = '  Timers do not ring  ';
    component.description = '  Nothing happened.\n';
    component.submit();

    const req = httpTesting.expectOne((r) => r.url.endsWith('/api/reports'));
    expect(req.request.body).toMatchObject({
      title: 'Timers do not ring',
      description: 'Nothing happened.',
    });
    req.flush(saved());
  });

  it('confirms with a link to the issue', () => {
    fill();
    component.submit();
    httpTesting.expectOne((r) => r.url.endsWith('/api/reports')).flush(saved());

    expect(component.sent()?.githubIssueNumber).toBe(42);
    expect(component.errorKey()).toBeNull();
  });

  it('still confirms when the report saved but did not reach GitHub', () => {
    // Saved is saved. Reporting this as a failure would be a lie that also loses
    // the reporter's words.
    fill();
    component.submit();
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/reports'))
      .flush(saved({ githubIssueUrl: null, githubIssueNumber: null, githubError: 'GitHub responded 401' }));

    expect(component.sent()).not.toBeNull();
    expect(component.sent()?.githubIssueUrl).toBeNull();
    expect(component.errorKey()).toBeNull();
  });

  describe('failures worth telling apart', () => {
    const failWith = (status: number) => {
      fill();
      component.submit();
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/reports'))
        .flush({ message: 'no' }, { status, statusText: 'Error' });
    };

    it('names a rate limit as a rate limit', () => {
      // Reported as a generic failure, someone retypes a perfectly good report.
      failWith(429);
      expect(component.errorKey()).toBe('report.errTooMany');
    });

    it('names an expired session', () => {
      failWith(401);
      expect(component.errorKey()).toBe('report.errSignedOut');
    });

    it('falls back to a generic failure', () => {
      failWith(500);
      expect(component.errorKey()).toBe('report.errFailed');
    });

    it('leaves the form usable so the text is not lost', () => {
      failWith(500);
      expect(component.busy()).toBe(false);
      // The words they typed are still there to resend.
      expect(component.title).toBe('Timers do not ring');
      expect(component.description).toBe('Locked the phone and nothing happened.');
    });
  });

  it('warns that the report becomes public before it is sent', () => {
    // The repository is public, so the text and the reporter's name become
    // world-readable and permanent. Discovering that from a link in the
    // confirmation would be too late.
    const warning = (fixture.nativeElement as HTMLElement).querySelector(
      '.report__warning',
    );
    expect(warning).not.toBeNull();
    // The two things a reporter must understand before typing.
    expect(warning?.textContent).toContain('public');
    expect(warning?.textContent).toContain('GitHub');
  });

  it('reports dismissal so the host can close it', () => {
    let dismissed = false;
    component.dismissed.subscribe(() => (dismissed = true));

    component.close();

    expect(dismissed).toBe(true);
  });
});
