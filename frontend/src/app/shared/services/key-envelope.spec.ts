import { describe, it, expect } from 'vitest';
import { sealKey, openKey, EnvelopeError, envelopeSupported } from './key-envelope';

const KEY = 'AIzaSyExampleLookingGeminiKey_0123456789';
const PASSPHRASE = 'correct horse battery staple';

describe('key-envelope', () => {
  it('is supported in the test environment', () => {
    // Everything below is vacuous without WebCrypto, so assert it up front.
    expect(envelopeSupported()).toBe(true);
  });

  it('round-trips a key', async () => {
    const envelope = await sealKey(KEY, PASSPHRASE);
    expect(await openKey(envelope, PASSPHRASE)).toBe(KEY);
  });

  it('never stores the key in the envelope', async () => {
    // The whole point: what the server receives must not contain the secret.
    const envelope = await sealKey(KEY, PASSPHRASE);
    expect(envelope).not.toContain(KEY);
    expect(envelope).not.toContain('AIzaSy');
  });

  it('produces different ciphertext each time', async () => {
    // Fresh salt and nonce, so two saves of the same key cannot be correlated.
    const first = await sealKey(KEY, PASSPHRASE);
    const second = await sealKey(KEY, PASSPHRASE);
    expect(first).not.toBe(second);
    // Both still open.
    expect(await openKey(first, PASSPHRASE)).toBe(KEY);
    expect(await openKey(second, PASSPHRASE)).toBe(KEY);
  });

  it('is a versioned JSON envelope', async () => {
    const envelope: unknown = JSON.parse(await sealKey(KEY, PASSPHRASE));
    expect(envelope).toMatchObject({
      v: 1,
      salt: expect.any(String),
      iv: expect.any(String),
      ct: expect.any(String),
    });
  });

  it('trims incidental whitespace off a pasted key', async () => {
    const envelope = await sealKey(`  ${KEY}\n`, PASSPHRASE);
    expect(await openKey(envelope, PASSPHRASE)).toBe(KEY);
  });

  describe('refusing to open', () => {
    it('rejects a wrong passphrase without returning plaintext', async () => {
      const envelope = await sealKey(KEY, PASSPHRASE);
      await expect(openKey(envelope, 'not the passphrase')).rejects.toThrow(EnvelopeError);
    });

    it('rejects tampered ciphertext', async () => {
      // AES-GCM authenticates, so an edited envelope must not decrypt to
      // anything at all rather than to garbage.
      const parsed = JSON.parse(await sealKey(KEY, PASSPHRASE)) as { ct: string };
      const flipped = parsed.ct.startsWith('A') ? 'B' : 'A';
      const tampered = JSON.stringify({
        ...parsed,
        ct: flipped + parsed.ct.slice(1),
      });

      await expect(openKey(tampered, PASSPHRASE)).rejects.toThrow(EnvelopeError);
    });

    it('names a future format instead of blaming the passphrase', async () => {
      // Otherwise someone retypes a correct passphrase forever.
      const parsed = JSON.parse(await sealKey(KEY, PASSPHRASE)) as Record<string, unknown>;
      const future = JSON.stringify({ ...parsed, v: 99 });

      await expect(openKey(future, PASSPHRASE)).rejects.toThrow(/newer format/i);
    });

    it('rejects a non-JSON envelope', async () => {
      await expect(openKey('not json at all', PASSPHRASE)).rejects.toThrow(EnvelopeError);
    });

    it('rejects an incomplete envelope', async () => {
      await expect(openKey(JSON.stringify({ v: 1, salt: 'x' }), PASSPHRASE)).rejects.toThrow(
        EnvelopeError,
      );
    });
  });

  describe('refusing to seal', () => {
    it('requires a key', async () => {
      await expect(sealKey('   ', PASSPHRASE)).rejects.toThrow(EnvelopeError);
    });

    it('requires a passphrase', async () => {
      // An empty passphrase would derive a key anyone could reproduce.
      await expect(sealKey(KEY, '')).rejects.toThrow(EnvelopeError);
    });
  });
});
