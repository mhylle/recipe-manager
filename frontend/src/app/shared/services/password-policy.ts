/**
 * The auth-service's password policy, mirrored client-side.
 *
 * One definition because two forms need it — registration and the profile
 * page's change-password — and the previous arrangement, where registration
 * carried its own inline rule, is how the two drifted apart from the server in
 * the first place (recipe-manager#47).
 *
 * The policy is deliberately length-only, per NIST SP 800-63B. Every character
 * is allowed: punctuation, spaces, non-ASCII. No character class is required,
 * and there is no digit requirement — composition rules push people toward
 * predictable mutations without adding entropy, and here the old
 * letters-and-digits-only rule was rejecting genuinely strong passphrases.
 *
 * Checking here as well as on the server is not redundant: the credential
 * endpoints allow five attempts a minute, so a typo caught locally is one that
 * does not spend one of them.
 *
 * Source of truth: auth-service `src/common/validation/is-password.decorator.ts`
 * and `docs/API.md` § Password Policy. If those move, this must follow.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt truncates its input at 72 bytes, so that is the point past which the
 * server stops looking at a password at all. Capping here keeps the form honest
 * rather than accepting something longer and implying all of it counted.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * Length in BYTES, which is what the limit above is counted in.
 *
 * `'é'` is one character and two bytes, so a form measuring `.length` would
 * happily accept a passphrase the server then refuses — the failure would
 * arrive as an opaque 400 after a round trip.
 */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Which rule a password breaks, or null when it satisfies the policy. */
export type PasswordProblem = 'tooShort' | 'tooLong';

export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'tooShort';
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return 'tooLong';
  }
  return null;
}
