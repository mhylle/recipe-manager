import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoginDialogComponent } from './login-dialog';
import { AuthService } from '../../services/auth.service';

describe('LoginDialogComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LoginDialogComponent>>;
  let component: LoginDialogComponent;
  let httpTesting: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(LoginDialogComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  const submitWith = (email: string, password: string) => {
    component.email = email;
    component.password = password;
    component.submit();
  };

  it('does not call the server with an empty field', () => {
    submitWith('', '');
    expect(component.errorKey()).toBe('login.errRequired');
    // verify() in afterEach fails if a request was made.
  });

  it('posts the credentials to the CENTRAL auth service, not this app', () => {
    // The password must go to mhylle.com's own endpoint. Anything else would
    // mean this app was handling credentials itself.
    submitWith('mhylle@yahoo.com', 'secret');
    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'mhylle@yahoo.com', password: 'secret' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: { email: 'mhylle@yahoo.com', firstName: 'Martin', lastName: 'Hylleberg' } });
  });

  it('trims the email but never the password', () => {
    // Trimming a password would silently reject a legitimate one that starts or
    // ends with a space.
    submitWith('  mhylle@yahoo.com  ', ' spaced ');
    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'mhylle@yahoo.com', password: ' spaced ' });
    req.flush({ success: true, data: { email: 'mhylle@yahoo.com' } });
  });

  it('signs the user in and reports success', () => {
    let signalled = false;
    component.signedIn.subscribe(() => (signalled = true));

    submitWith('mhylle@yahoo.com', 'right');
    httpTesting
      .expectOne('/api/auth/login')
      .flush({ success: true, data: { email: 'mhylle@yahoo.com', firstName: 'Martin', lastName: 'Hylleberg' } });

    expect(signalled).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.displayName()).toBe('Martin Hylleberg');
    expect(component.errorKey()).toBeNull();
  });

  it('forgets the password after a successful sign-in', () => {
    submitWith('mhylle@yahoo.com', 'right');
    httpTesting.expectOne('/api/auth/login').flush({ success: true, data: { email: 'mhylle@yahoo.com' } });
    expect(component.password).toBe('');
  });

  it('reports a rejected password and forgets it', () => {
    submitWith('mhylle@yahoo.com', 'wrong');
    httpTesting
      .expectOne('/api/auth/login')
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.errorKey()).toBe('login.errBadCredentials');
    expect(component.password).toBe('');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('distinguishes the rate limiter from a wrong password', () => {
    // nginx allows 5 credential attempts a minute. Calling that "wrong password"
    // sends someone hunting for a typo that is not there.
    submitWith('mhylle@yahoo.com', 'right');
    httpTesting
      .expectOne('/api/auth/login')
      .flush('', { status: 429, statusText: 'Too Many Requests' });

    expect(component.errorKey()).toBe('login.errTooMany');
  });

  it('treats success:false as a failure even on a 200', () => {
    // A 200 carrying success:false would otherwise look like a sign-in.
    submitWith('mhylle@yahoo.com', 'wrong');
    httpTesting.expectOne('/api/auth/login').flush({ success: false });

    expect(auth.isAuthenticated()).toBe(false);
    expect(component.errorKey()).toBe('login.errBadCredentials');
  });

  it('does not fire a second request while one is in flight', () => {
    submitWith('mhylle@yahoo.com', 'right');
    component.submit();
    // expectOne fails if the double-submit produced two.
    httpTesting.expectOne('/api/auth/login').flush({ success: true, data: { email: 'a@b.c' } });
  });
});
