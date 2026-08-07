import { describe, it, expect } from 'vitest';
import {
  byteLength,
  checkPassword,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from './password-policy';

/**
 * The cases here are the ones that were actually broken. #47 was reported
 * because a password containing a full stop was refused, so the passphrases in
 * the first block are the regression: if any of them starts failing again, the
 * composition rule has crept back in.
 */
describe('password policy', () => {
  describe('every character is allowed', () => {
    it.each([
      ['Ada.Lovelace,1815', 'full stops and commas — the reported case'],
      ['Abcdefg1!', 'an exclamation mark'],
      ['correct horse battery', 'spaces'],
      ['rødgrød med fløde', 'non-ASCII'],
      ['♥♥♥♥♥♥♥♥', 'symbols only, no letters or digits at all'],
      ['abcdefgh', 'no digit — the digit requirement is gone'],
    ])('accepts %s (%s)', (password) => {
      expect(checkPassword(password)).toBeNull();
    });
  });

  describe('length is the whole policy', () => {
    it('refuses anything under the minimum', () => {
      expect(checkPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe('tooShort');
    });

    it('accepts exactly the minimum', () => {
      // The boundary, in the direction that would lock someone out.
      expect(checkPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
    });

    it('accepts exactly the maximum', () => {
      expect(checkPassword('a'.repeat(PASSWORD_MAX_BYTES))).toBeNull();
    });

    it('refuses one byte past the maximum', () => {
      expect(checkPassword('a'.repeat(PASSWORD_MAX_BYTES + 1))).toBe('tooLong');
    });
  });

  describe('the maximum counts bytes, not characters', () => {
    it('refuses 37 accented characters, which are 74 bytes', () => {
      // The distractor: a check using .length sees 37 and passes it, then the
      // server refuses it — bcrypt truncates at 72 bytes and never saw the rest.
      const password = 'é'.repeat(37);

      expect(password.length).toBe(37);
      expect(byteLength(password)).toBe(74);
      expect(checkPassword(password)).toBe('tooLong');
    });

    it('measures ASCII as one byte per character', () => {
      expect(byteLength('abcdefgh')).toBe(8);
    });
  });
});
