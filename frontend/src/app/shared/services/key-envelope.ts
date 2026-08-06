/**
 * Client-side encryption for a user's API key.
 *
 * The key is encrypted here, in the browser, with a passphrase that never leaves
 * it. The server stores the resulting envelope and cannot decrypt it — so a
 * database leak yields ciphertext rather than working credentials.
 *
 * Be precise about what this does NOT give you: generation happens server-side,
 * so the plaintext key is sent with a generation request and the server sees it
 * for the duration of that call. This is zero-knowledge **at rest**, not
 * end-to-end. Do not describe it as the latter.
 */

/** Bumped when the KDF or cipher changes, so old envelopes stay readable. */
const ENVELOPE_VERSION = 1;

/**
 * OWASP's floor for PBKDF2-SHA256 at the time of writing.
 *
 * High enough to make an offline guessing attack on a stolen envelope expensive,
 * low enough that unlocking on a mid-range phone stays under a second.
 */
const PBKDF2_ITERATIONS = 310_000;

const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM's standard nonce length.

export interface KeyEnvelope {
  v: number;
  salt: string;
  iv: string;
  ct: string;
}

/** Thrown for every failure mode a user can act on. */
export class EnvelopeError extends Error {}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Whether this browser can do the crypto at all. */
export function envelopeSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      // BufferSource; a plain Uint8Array is accepted.
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt an API key under a passphrase.
 *
 * A fresh salt and nonce every time, so saving the same key twice produces
 * different ciphertext and nothing can be inferred by comparing envelopes.
 */
export async function sealKey(apiKey: string, passphrase: string): Promise<string> {
  if (!envelopeSupported()) {
    throw new EnvelopeError('This browser cannot encrypt the key.');
  }
  if (apiKey.trim().length === 0) {
    throw new EnvelopeError('There is no key to encrypt.');
  }
  if (passphrase.length === 0) {
    throw new EnvelopeError('A passphrase is required.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(apiKey.trim()),
  );

  const envelope: KeyEnvelope = {
    v: ENVELOPE_VERSION,
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    ct: toBase64Url(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

/**
 * Recover the API key from an envelope.
 *
 * A wrong passphrase and a tampered envelope are indistinguishable here, and
 * deliberately so: AES-GCM's authentication tag fails either way, and both mean
 * the same thing to whoever is typing — that they cannot unlock it.
 */
export async function openKey(envelopeJson: string, passphrase: string): Promise<string> {
  if (!envelopeSupported()) {
    throw new EnvelopeError('This browser cannot decrypt the key.');
  }

  let envelope: KeyEnvelope;
  try {
    const parsed: unknown = JSON.parse(envelopeJson);
    if (parsed === null || typeof parsed !== 'object') throw new Error('not an object');
    envelope = parsed as KeyEnvelope;
  } catch {
    throw new EnvelopeError('The stored key is not readable.');
  }

  // A newer envelope than this build understands. Saying so beats failing as if
  // the passphrase were wrong, which would send someone retyping it forever.
  if (envelope.v !== ENVELOPE_VERSION) {
    throw new EnvelopeError(
      `The stored key uses a newer format (v${String(envelope.v)}). Reload the app.`,
    );
  }
  if (!envelope.salt || !envelope.iv || !envelope.ct) {
    throw new EnvelopeError('The stored key is incomplete.');
  }

  try {
    const key = await deriveKey(passphrase, fromBase64Url(envelope.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(envelope.iv) as unknown as BufferSource },
      key,
      fromBase64Url(envelope.ct) as unknown as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new EnvelopeError('That passphrase did not unlock the key.');
  }
}
