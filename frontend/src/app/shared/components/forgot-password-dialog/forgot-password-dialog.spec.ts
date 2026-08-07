import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog';

describe('ForgotPasswordDialogComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ForgotPasswordDialogComponent>>;
  let component: ForgotPasswordDialogComponent;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ForgotPasswordDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ForgotPasswordDialogComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  it('asks the auth-service for a reset link', () => {
    component.email = 'cook@example.com';
    component.submit();

    const req = httpTesting.expectOne('/api/auth/forgot-password');
    expect(req.request.body).toEqual({ email: 'cook@example.com' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true });

    expect(component.sent()).toBe(true);
  });

  it('trims the address', () => {
    component.email = '  cook@example.com  ';
    component.submit();

    const req = httpTesting.expectOne('/api/auth/forgot-password');
    expect(req.request.body).toEqual({ email: 'cook@example.com' });
    req.flush({ success: true });
  });

  it('confirms without revealing whether the address has an account', () => {
    // Anything else turns this form into a way to enumerate who is registered.
    component.email = 'nobody@example.com';
    component.submit();
    httpTesting.expectOne('/api/auth/forgot-password').flush({ success: true });
    // The signal changed; the template needs a pass before it reflects it.
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // The copy is conditional by design: "IF that address has an account".
    expect(html.toLowerCase()).toContain('if that address has an account');
  });

  describe('before sending', () => {
    it('requires something email-shaped', () => {
      component.email = 'not-an-email';
      component.submit();

      expect(component.errorKey()).toBe('forgot.errEmail');
      httpTesting.expectNone('/api/auth/forgot-password');
    });

    it('requires an address at all', () => {
      component.submit();
      expect(component.errorKey()).toBe('forgot.errEmail');
      httpTesting.expectNone('/api/auth/forgot-password');
    });
  });

  describe('failures worth telling apart', () => {
    const failWith = (status: number) => {
      component.email = 'cook@example.com';
      component.submit();
      httpTesting
        .expectOne('/api/auth/forgot-password')
        .flush({ message: 'no' }, { status, statusText: 'Error' });
    };

    it('names throttling as throttling', () => {
      // Reported as a failure, someone retypes a correct address.
      failWith(429);
      expect(component.errorKey()).toBe('forgot.errTooMany');
      expect(component.sent()).toBe(false);
    });

    it('falls back to a generic failure', () => {
      failWith(500);
      expect(component.errorKey()).toBe('forgot.errFailed');
    });

    it('leaves the form usable so the address is not lost', () => {
      failWith(500);
      expect(component.busy()).toBe(false);
      expect(component.email).toBe('cook@example.com');
    });
  });

  it('offers a way back to sign-in', () => {
    let asked = false;
    component.wantsSignIn.subscribe(() => (asked = true));

    component.backToSignIn();

    expect(asked).toBe(true);
  });

  it('reports dismissal so the host can close it', () => {
    let dismissed = false;
    component.dismissed.subscribe(() => (dismissed = true));

    component.cancel();

    expect(dismissed).toBe(true);
  });
});
