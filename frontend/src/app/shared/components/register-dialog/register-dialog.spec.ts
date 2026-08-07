import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RegisterDialogComponent } from './register-dialog';
import { AuthService } from '../../services/auth.service';

describe('RegisterDialogComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<RegisterDialogComponent>>;
  let component: RegisterDialogComponent;
  let httpTesting: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RegisterDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(RegisterDialogComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  const fillValid = () => {
    component.email = 'new.cook@example.com';
    component.firstName = 'New';
    component.lastName = 'Cook';
    component.password = 'kitchen1';
    component.confirmPassword = 'kitchen1';
  };

  describe('client-side checks (before spending a rate-limited attempt)', () => {
    it('refuses an incomplete form without calling the server', () => {
      component.email = 'new.cook@example.com';
      component.submit();

      expect(component.errorKey()).toBe('register.errRequired');
      httpTesting.expectNone('/api/auth/register');
    });

    it('catches mismatched passwords locally', () => {
      // Only five attempts a minute are allowed, so a typo must not burn one.
      fillValid();
      component.confirmPassword = 'kitchen2';
      component.submit();

      expect(component.errorKey()).toBe('register.errPasswordMismatch');
      httpTesting.expectNone('/api/auth/register');
    });

    it('catches a password with no digit, matching the server rule', () => {
      fillValid();
      component.password = 'kitchen';
      component.confirmPassword = 'kitchen';
      component.submit();

      expect(component.errorKey()).toBe('register.errPasswordWeak');
      httpTesting.expectNone('/api/auth/register');
    });

    it('sends a passphrase with punctuation, which used to be refused here', () => {
      // The #47 regression. This exact shape was rejected client-side before the
      // auth-service dropped its letters-and-digits-only rule, so it must now
      // reach the network rather than being stopped by the form.
      fillValid();
      component.password = 'Ada.Lovelace,1815';
      component.confirmPassword = 'Ada.Lovelace,1815';
      component.submit();

      expect(component.errorKey()).toBeNull();
      httpTesting.expectOne('/api/auth/register').flush({ success: true });
      httpTesting.expectOne('/api/auth/login').flush({ success: false });
    });

    it('sends a password with no digit at all', () => {
      // The digit requirement is gone with the charset rule.
      fillValid();
      component.password = 'correct horse battery';
      component.confirmPassword = 'correct horse battery';
      component.submit();

      httpTesting.expectOne('/api/auth/register').flush({ success: true });
      httpTesting.expectOne('/api/auth/login').flush({ success: false });
    });

    it('catches a password that is too long in BYTES', () => {
      // 37 accented characters are 74 bytes. A check counting characters would
      // pass this and let the server refuse it after a round trip.
      fillValid();
      const long = 'é'.repeat(37);
      component.password = long;
      component.confirmPassword = long;
      component.submit();

      expect(component.errorKey()).toBe('register.errPasswordLong');
      httpTesting.expectNone('/api/auth/register');
    });

    it('catches a too-short password', () => {
      fillValid();
      component.password = 'ab1';
      component.confirmPassword = 'ab1';
      component.submit();

      expect(component.errorKey()).toBe('register.errPasswordWeak');
      httpTesting.expectNone('/api/auth/register');
    });
  });

  describe('registering', () => {
    it('sends the auth-service its exact contract, including confirmPassword', () => {
      fillValid();
      component.submit();

      const req = httpTesting.expectOne('/api/auth/register');
      expect(req.request.body).toEqual({
        email: 'new.cook@example.com',
        firstName: 'New',
        lastName: 'Cook',
        password: 'kitchen1',
        confirmPassword: 'kitchen1',
      });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, message: 'Registration request received' });

      // Registration sets no cookie, so a login must follow or the new cook
      // lands back on the sign-in dialog wondering whether it worked.
      httpTesting.expectOne('/api/auth/login').flush({
        success: true,
        data: { email: 'new.cook@example.com' },
      });
      httpTesting.expectOne((r) => r.url.endsWith('/api/me')).flush({
        id: 'local-1',
        canContribute: false,
      });
    });

    it('trims whitespace off the email and name', () => {
      fillValid();
      component.email = '  new.cook@example.com  ';
      component.firstName = ' New ';
      component.submit();

      const req = httpTesting.expectOne('/api/auth/register');
      expect(req.request.body).toMatchObject({
        email: 'new.cook@example.com',
        firstName: 'New',
      });
      req.flush({ success: true });
      httpTesting.expectOne('/api/auth/login').flush({ success: false });
    });

    it('signs the new account in and reports arrival', () => {
      let registered = false;
      component.registered.subscribe(() => (registered = true));

      fillValid();
      component.submit();
      httpTesting.expectOne('/api/auth/register').flush({ success: true });
      httpTesting
        .expectOne('/api/auth/login')
        .flush({ success: true, data: { email: 'new.cook@example.com' } });
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/me'))
        .flush({ id: 'local-1', canContribute: false });

      expect(registered).toBe(true);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('leaves a new account WITHOUT contribution rights', () => {
      // The whole point of the gate: registering is self-service, writing to the
      // shared library is not.
      fillValid();
      component.submit();
      httpTesting.expectOne('/api/auth/register').flush({ success: true });
      httpTesting
        .expectOne('/api/auth/login')
        .flush({ success: true, data: { email: 'new.cook@example.com' } });
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/me'))
        .flush({ id: 'local-1', canContribute: false });

      expect(auth.canContribute()).toBe(false);
    });

    it('never keeps the password after a failure', () => {
      fillValid();
      component.submit();
      httpTesting
        .expectOne('/api/auth/register')
        .flush({ message: 'nope' }, { status: 400, statusText: 'Bad Request' });

      expect(component.password).toBe('');
      expect(component.confirmPassword).toBe('');
    });
  });

  describe('error reporting', () => {
    const failWith = (status: number) => {
      fillValid();
      component.submit();
      httpTesting
        .expectOne('/api/auth/register')
        .flush({ message: 'x' }, { status, statusText: 'Error' });
    };

    it('names throttling as throttling', () => {
      // Reporting 429 as a bad address sends someone editing a good email.
      failWith(429);
      expect(component.errorKey()).toBe('register.errTooMany');
    });

    it('tells a returning user to sign in instead', () => {
      failWith(409);
      expect(component.errorKey()).toBe('register.errEmailTaken');
    });

    it('falls back to a generic failure for a server error', () => {
      failWith(500);
      expect(component.errorKey()).toBe('register.errFailed');
    });

    it('clears busy so the form can be retried', () => {
      failWith(500);
      expect(component.busy()).toBe(false);
    });
  });

  it('offers a way back to sign-in', () => {
    let asked = false;
    component.wantsSignIn.subscribe(() => (asked = true));

    component.signInInstead();

    expect(asked).toBe(true);
  });
});
