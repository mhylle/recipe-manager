import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, type UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, type Observable } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canContributeGuard } from './can-contribute.guard';
import { AuthService } from '../services/auth.service';

describe('canContributeGuard', () => {
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpTesting.verify());

  /** Guards must be run inside an injection context. */
  const run = () =>
    TestBed.runInInjectionContext(() =>
      // The route arguments are unused by this guard.
      canContributeGuard(null as never, null as never),
    );

  const resolveOf = async (result: ReturnType<typeof run>) =>
    isObservable(result) ? await firstValueFrom(result) : result;

  it('lets a known contributor straight through, with no round trip', async () => {
    auth.canContribute.set(true);

    expect(await resolveOf(run())).toBe(true);
    // The ordinary path — clicking "add recipe" from the list must not wait on
    // the network for something already known.
    httpTesting.expectNone('/api/auth/validate');
  });

  it('resolves the session before judging an unknown caller', async () => {
    // A cold navigation straight to /recipes/new runs the guard before /api/me
    // has answered. Bouncing a legitimate contributor here would be a bug that
    // only ever appeared on reload.
    const result = run();
    expect(isObservable(result)).toBe(true);

    const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ success: true, data: { email: 'cook@example.com' } });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/me'))
      .flush({ id: 'local-1', canContribute: true });

    expect(await settled).toBe(true);
  });

  it('redirects to the library when the account may not contribute', async () => {
    const result = run();
    const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ success: true, data: { email: 'cook@example.com' } });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/me'))
      .flush({ id: 'local-1', canContribute: false });

    const outcome = await settled;
    // "Here are the recipes you can read" beats an error page.
    expect(outcome).toEqual(router.createUrlTree(['/recipes']));
  });

  it('redirects a signed-out guest rather than showing them the form', async () => {
    const result = run();
    const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });

    expect(await settled).toEqual(router.createUrlTree(['/recipes']));
  });

  it('fails closed when the identity call itself errors', async () => {
    // An unreachable /api/me must not read as "allowed".
    const result = run();
    const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ success: true, data: { email: 'cook@example.com' } });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/me'))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(await settled).toEqual(router.createUrlTree(['/recipes']));
    expect(auth.canContribute()).toBe(false);
  });
});
