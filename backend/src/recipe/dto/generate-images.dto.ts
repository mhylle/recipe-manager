import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/**
 * The caller's own Gemini key, supplied per generation.
 *
 * Sent with the request rather than read from storage server-side, because the
 * stored copy is encrypted with a passphrase only the user knows — the browser
 * decrypts it and forwards the plaintext for the duration of this one call.
 *
 * A user may also paste a key without ever saving it, which is the same request
 * from the server's point of view. That is the whole reason the key is a request
 * parameter and not a lookup.
 */
export class GenerateImagesDto {
  /**
   * Length-bounded rather than pattern-matched. Google has changed its key
   * format before, and a regex that rejects a valid new-style key would be a
   * confusing failure for something the server merely forwards.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(200)
  apiKey: string;
}
