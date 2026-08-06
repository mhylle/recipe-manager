import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiKeyDialogComponent } from './gemini-key-dialog';
import { sealKey } from '../../services/key-envelope';

describe('GeminiKeyDialogComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<GeminiKeyDialogComponent>>;
  let component: GeminiKeyDialogComponent;
  let httpTesting: HttpTestingController;

  const KEY = 'AIzaSyExampleLookingGeminiKey_0123456789';
  const PASS = 'a good long passphrase';

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [GeminiKeyDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(GeminiKeyDialogComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const flushKeyState = (envelope: string | null) =>
    httpTesting.expectOne((r) => r.url.endsWith('/api/profile/gemini-key')).flush({
      configured: envelope !== null,
      envelope,
      updatedAt: envelope !== null ? '2026-08-06T00:00:00.000Z' : null,
    });

  describe('with a stored key', () => {
    it('unlocks it with the passphrase and emits the plaintext', async () => {
      const envelope = await sealKey(KEY, PASS);
      fixture.detectChanges();
      flushKeyState(envelope);

      let emitted: string | null = null;
      component.unlocked.subscribe((k) => (emitted = k));

      component.passphrase = PASS;
      await component.submit();

      expect(emitted).toBe(KEY);
    });

    it('reports a wrong passphrase and emits nothing', async () => {
      const envelope = await sealKey(KEY, PASS);
      fixture.detectChanges();
      flushKeyState(envelope);

      let emitted: string | null = null;
      component.unlocked.subscribe((k) => (emitted = k));

      component.passphrase = 'wrong passphrase entirely';
      await component.submit();

      expect(emitted).toBeNull();
      expect(component.errorKey()).toBe('geminiKey.errPassphrase');
      // Cleared, so a retry starts from an empty field rather than a stale one.
      expect(component.passphrase).toBe('');
    });

    it('offers the unlock path by default', () => {
      fixture.detectChanges();
      flushKeyState('{"v":1,"salt":"x","iv":"y","ct":"z"}');

      expect(component.hasStoredKey()).toBe(true);
      expect(component.pasting()).toBe(false);
    });

    it('lets the user paste a different key instead', async () => {
      fixture.detectChanges();
      flushKeyState('{"v":1,"salt":"x","iv":"y","ct":"z"}');

      component.usePasteInstead();
      let emitted: string | null = null;
      component.unlocked.subscribe((k) => (emitted = k));

      component.apiKey = '  another-key-entirely  ';
      await component.submit();

      // Trimmed, and never stored anywhere.
      expect(emitted).toBe('another-key-entirely');
      httpTesting.expectNone((r) => r.method === 'PUT');
    });
  });

  describe('with no stored key', () => {
    it('goes straight to the paste field', () => {
      // A passphrase box with nothing to unlock would be a dead end.
      fixture.detectChanges();
      flushKeyState(null);

      expect(component.hasStoredKey()).toBe(false);
      expect(component.pasting()).toBe(true);
    });

    it('emits a pasted key without saving it', async () => {
      fixture.detectChanges();
      flushKeyState(null);

      let emitted: string | null = null;
      component.unlocked.subscribe((k) => (emitted = k));

      component.apiKey = KEY;
      await component.submit();

      expect(emitted).toBe(KEY);
      // The whole point of the use-without-saving path.
      httpTesting.expectNone((r) => r.method === 'PUT');
      expect(component.apiKey).toBe('');
    });

    it('requires something to be entered', async () => {
      fixture.detectChanges();
      flushKeyState(null);

      let emitted: string | null = null;
      component.unlocked.subscribe((k) => (emitted = k));

      await component.submit();

      expect(emitted).toBeNull();
      expect(component.errorKey()).toBe('geminiKey.errRequired');
    });
  });

  it('falls back to pasting when the key state cannot be read', () => {
    fixture.detectChanges();
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/profile/gemini-key'))
      .flush({ message: 'no' }, { status: 500, statusText: 'Error' });

    expect(component.pasting()).toBe(true);
  });

  it('reports dismissal so the caller can stop waiting', () => {
    fixture.detectChanges();
    flushKeyState(null);

    let dismissed = false;
    component.dismissed.subscribe(() => (dismissed = true));

    component.cancel();

    expect(dismissed).toBe(true);
  });
});
