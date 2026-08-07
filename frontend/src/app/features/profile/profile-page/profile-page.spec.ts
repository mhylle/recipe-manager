import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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

  /**
   * Answer the two GETs the constructor fires: the Gemini key state and the MCP
   * key list. Both must be satisfied or httpTesting.verify() fails the case.
   */
  const flushState = (configured = false) => {
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/gemini-key') && r.method === 'GET')
      .flush({ configured, envelope: null, updatedAt: null });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/mcp-keys') && r.method === 'GET')
      .flush([]);
  };

  const fillValid = () => {
    component.apiKey = KEY;
    component.passphrase = PASS;
    component.confirmPassphrase = PASS;
  };

  describe('changing the account password', () => {
    const fillPassword = (
      current = 'old-password',
      next = 'Ada.Lovelace,1815',
      confirm = next,
    ) => {
      component.currentPassword = current;
      component.newPassword = next;
      component.confirmNewPassword = confirm;
    };

    it('sends exactly the two fields the endpoint accepts', () => {
      // The auth-service validates with forbidNonWhitelisted, so a third field
      // — confirmPassword, which its old docs wrongly showed — is a 400.
      flushState();
      fillPassword();

      component.changePassword();

      const req = httpTesting.expectOne('/api/auth/change-password');
      expect(Object.keys(req.request.body as object).sort()).toEqual([
        'currentPassword',
        'newPassword',
      ]);
      req.flush({ success: true });
    });

    it('accepts a passphrase with punctuation', () => {
      // The #47 rule is gone. A change-password form that kept it would reject
      // exactly the passwords the policy now encourages.
      flushState();
      fillPassword('old-password', 'correct horse battery staple');

      component.changePassword();

      httpTesting.expectOne('/api/auth/change-password').flush({ success: true });
      expect(component.passwordMessage()).toBe('profile.password.changed');
    });

    it('clears the fields once it has landed', () => {
      // They are secrets; leaving them in the DOM after the change is done is
      // the kind of thing a shared kitchen tablet makes expensive.
      flushState();
      fillPassword();

      component.changePassword();
      httpTesting.expectOne('/api/auth/change-password').flush({ success: true });

      expect(component.currentPassword).toBe('');
      expect(component.newPassword).toBe('');
      expect(component.confirmNewPassword).toBe('');
    });

    it('catches a mismatch without spending a throttled attempt', () => {
      // The endpoint shares login's five-a-minute brake.
      flushState();
      fillPassword('old-password', 'Ada.Lovelace,1815', 'something-else');

      component.changePassword();

      expect(component.passwordMessage()).toBe('profile.password.errMismatch');
      httpTesting.expectNone('/api/auth/change-password');
    });

    it('catches a too-short new password locally', () => {
      flushState();
      fillPassword('old-password', 'short');

      component.changePassword();

      expect(component.passwordMessage()).toBe('profile.password.errWeak');
      httpTesting.expectNone('/api/auth/change-password');
    });

    it('refuses a new password identical to the current one', () => {
      flushState();
      fillPassword('Ada.Lovelace,1815', 'Ada.Lovelace,1815');

      component.changePassword();

      expect(component.passwordMessage()).toBe('profile.password.errSame');
      httpTesting.expectNone('/api/auth/change-password');
    });

    it('reads 401 as a wrong current password, not an expired session', () => {
      // The cookie was accepted or the request would not have reached
      // validation at all.
      flushState();
      fillPassword();

      component.changePassword();
      httpTesting
        .expectOne('/api/auth/change-password')
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(component.passwordMessage()).toBe('profile.password.errWrongCurrent');
    });

    it('reads 429 as throttling rather than a wrong password', () => {
      // Reporting the throttle as a wrong password sends someone hunting for a
      // mistake they did not make.
      flushState();
      fillPassword();

      component.changePassword();
      httpTesting
        .expectOne('/api/auth/change-password')
        .flush({}, { status: 429, statusText: 'Too Many Requests' });

      expect(component.passwordMessage()).toBe('profile.password.errTooMany');
    });

    it('keeps the current password on a failure so only one field is retyped', () => {
      flushState();
      fillPassword();

      component.changePassword();
      httpTesting
        .expectOne('/api/auth/change-password')
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(component.currentPassword).toBe('old-password');
      expect(component.newPassword).toBe('');
    });
  });

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
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/mcp-keys'))
      .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.state()).toBeNull();
    expect(component.mcpKeys()).toEqual([]);
  });

  describe('MCP keys', () => {
    it('shows a freshly created token exactly once', () => {
      flushState();
      component.mcpLabel = 'work laptop';
      component.createMcpKey();

      httpTesting
        .expectOne((r) => r.url.endsWith('/api/profile/mcp-keys') && r.method === 'POST')
        .flush({
          id: 'k-1',
          label: 'work laptop',
          prefix: 'rmk_abcd1234',
          createdAt: '2026-08-06T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null,
          token: 'rmk_the-actual-secret-token',
        });

      expect(component.freshToken()).toBe('rmk_the-actual-secret-token');
      expect(component.mcpKeys()).toHaveLength(1);
      // Dismissing takes it off the screen; nothing can fetch it back.
      component.dismissToken();
      expect(component.freshToken()).toBeNull();
    });

    it('requires a label, so a key can be recognised later', () => {
      flushState();
      component.createMcpKey();

      expect(component.mcpErrorKey()).toBe('profile.mcp.errLabel');
      httpTesting.expectNone((r) => r.method === 'POST');
    });

    it('marks a revoked key rather than dropping it from the list', () => {
      flushState();
      component.mcpKeys.set([
        {
          id: 'k-1',
          label: 'old laptop',
          prefix: 'rmk_abcd1234',
          createdAt: '2026-08-01T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null,
        },
      ]);

      component.revokeMcpKey('k-1');
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/profile/mcp-keys/k-1') && r.method === 'DELETE')
        .flush(null, { status: 204, statusText: 'No Content' });

      // Still listed, so revoking does not look like it never existed.
      expect(component.mcpKeys()).toHaveLength(1);
      expect(component.isActive(component.mcpKeys()[0])).toBe(false);
    });
  });
});
