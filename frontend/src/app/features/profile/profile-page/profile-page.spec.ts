import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfilePageComponent } from './profile-page';
import { openKey } from '../../../shared/services/key-envelope';

describe('ProfilePageComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ProfilePageComponent>>;
  let component: ProfilePageComponent;
  let httpTesting: HttpTestingController;

  const KEY = 'AIzaSyExampleLookingGeminiKey_0123456789';
  const PASS = 'a good long passphrase';

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ProfilePageComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);

    // The constructor resolves the session and the stored-key state.
    httpTesting.expectOne('/api/auth/validate').flush({
      success: true,
      data: { email: 'cook@example.com' },
    });
    httpTesting.expectOne((r) => r.url.endsWith('/api/me')).flush({
      id: 'local-1',
      canContribute: true,
    });
  });

  afterEach(() => httpTesting.verify());

  /** Answer the initial GET of the key state. */
  const flushState = (configured = false) =>
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/gemini-key') && r.method === 'GET')
      .flush({ configured, envelope: null, updatedAt: null });

  const fillValid = () => {
    component.apiKey = KEY;
    component.passphrase = PASS;
    component.confirmPassphrase = PASS;
  };

  describe('validation before any request', () => {
    it('requires a key and a passphrase', async () => {
      flushState();
      await component.save();

      expect(component.message()).toBe('profile.gemini.errRequired');
      httpTesting.expectNone((r) => r.method === 'PUT');
    });

    it('rejects a short passphrase', async () => {
      // The envelope is only as strong as what derives it, and an offline
      // attacker gets unlimited guesses against a stolen copy.
      flushState();
      component.apiKey = KEY;
      component.passphrase = 'short';
      component.confirmPassphrase = 'short';
      await component.save();

      expect(component.message()).toBe('profile.gemini.errPassphraseShort');
      httpTesting.expectNone((r) => r.method === 'PUT');
    });

    it('rejects mismatched passphrases', async () => {
      flushState();
      component.apiKey = KEY;
      component.passphrase = PASS;
      component.confirmPassphrase = `${PASS} typo`;
      await component.save();

      expect(component.message()).toBe('profile.gemini.errMismatch');
      httpTesting.expectNone((r) => r.method === 'PUT');
    });
  });

  describe('saving', () => {
    it('sends an ENCRYPTED envelope, never the key', async () => {
      flushState();
      fillValid();
      await component.save();

      const req = httpTesting.expectOne(
        (r) => r.url.endsWith('/api/profile/gemini-key') && r.method === 'PUT',
      );
      const body = req.request.body as { envelope: string };

      // The one assertion this whole feature exists for.
      expect(body.envelope).not.toContain(KEY);
      expect(JSON.stringify(req.request.body)).not.toContain(KEY);
      // And it is a real envelope, openable with the passphrase.
      expect(await openKey(body.envelope, PASS)).toBe(KEY);

      req.flush({ configured: true, envelope: body.envelope, updatedAt: '2026-08-06T00:00:00.000Z' });
    });

    it('clears the plaintext key and passphrase from the component', async () => {
      flushState();
      fillValid();
      await component.save();

      // Nothing keeps the secret in memory after it has been sealed.
      expect(component.apiKey).toBe('');
      expect(component.passphrase).toBe('');
      expect(component.confirmPassphrase).toBe('');

      httpTesting
        .expectOne((r) => r.method === 'PUT')
        .flush({ configured: true, envelope: 'x', updatedAt: null });
    });

    it('reports success and reflects that a key is now stored', async () => {
      flushState();
      fillValid();
      await component.save();
      httpTesting
        .expectOne((r) => r.method === 'PUT')
        .flush({ configured: true, envelope: 'x', updatedAt: '2026-08-06T00:00:00.000Z' });

      expect(component.message()).toBe('profile.gemini.saved');
      expect(component.messageIsError()).toBe(false);
      expect(component.state()?.configured).toBe(true);
      expect(component.busy()).toBe(false);
    });

    it('reports a failed save without leaving the form busy', async () => {
      flushState();
      fillValid();
      await component.save();
      httpTesting
        .expectOne((r) => r.method === 'PUT')
        .flush({ message: 'no' }, { status: 500, statusText: 'Error' });

      expect(component.message()).toBe('profile.gemini.errFailed');
      expect(component.messageIsError()).toBe(true);
      expect(component.busy()).toBe(false);
    });
  });

  describe('removing', () => {
    it('clears the stored state', () => {
      flushState(true);
      component.remove();
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/profile/gemini-key') && r.method === 'DELETE')
        .flush(null, { status: 204, statusText: 'No Content' });

      expect(component.state()?.configured).toBe(false);
      expect(component.message()).toBe('profile.gemini.removed');
    });
  });

  it('shows nothing rather than erroring when the key state cannot be read', () => {
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/gemini-key'))
      .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.state()).toBeNull();
  });
});
