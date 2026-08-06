import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** What the profile page needs to know about a stored key. */
export interface GeminiKeyState {
  configured: boolean;
  /** The encrypted envelope, for the browser to decrypt. Null when unset. */
  envelope: string | null;
  updatedAt: string | null;
}

/**
 * A user's own settings.
 *
 * The Gemini key here is ciphertext the server cannot read. This service moves
 * it in and out of the database and does nothing else with it — no decryption,
 * no validation of the key inside, no use of it on the user's behalf. Generation
 * receives the plaintext key on the request that needs it, and never from here.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeminiKey(userId: string): Promise<GeminiKeyState> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { geminiKeyEnvelope: true, geminiKeyUpdatedAt: true },
    });
    return {
      configured: Boolean(user?.geminiKeyEnvelope),
      envelope: user?.geminiKeyEnvelope ?? null,
      updatedAt: user?.geminiKeyUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Store an envelope.
   *
   * Parsed only to confirm it is JSON. That catches a client that sent a raw key
   * by mistake — which would mean storing a secret in plaintext, the exact
   * failure this design exists to prevent — without the server taking a view on
   * the crypto inside.
   */
  async saveGeminiKey(
    userId: string,
    envelope: string,
  ): Promise<GeminiKeyState> {
    try {
      const parsed: unknown = JSON.parse(envelope);
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('not an object');
      }
    } catch {
      throw new BadRequestException(
        'The Gemini key envelope must be JSON produced by the client encrypter.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { geminiKeyEnvelope: envelope, geminiKeyUpdatedAt: new Date() },
    });
    return this.getGeminiKey(userId);
  }

  /** Forget it. Clearing the timestamp too, so nothing implies a key remains. */
  async deleteGeminiKey(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { geminiKeyEnvelope: null, geminiKeyUpdatedAt: null },
    });
  }
}
