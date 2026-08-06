import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * The client-side-encrypted envelope for a user's Gemini key.
 *
 * Opaque to the server on purpose. It is validated for size and for being
 * well-formed JSON — enough to catch a broken client before storing rubbish —
 * but NOT for its inner fields. Checking those would couple the backend to a
 * crypto format whose whole point is that it can be revised client-side with a
 * version bump instead of a migration.
 *
 * The server must never attempt to decrypt this. It cannot: the passphrase never
 * leaves the browser.
 */
export class SaveGeminiKeyDto {
  @IsString()
  @IsNotEmpty()
  // Generous but bounded. A real envelope is a few hundred bytes; anything near
  // this is a client bug or someone using the column as storage.
  @MaxLength(4096)
  envelope: string;
}
