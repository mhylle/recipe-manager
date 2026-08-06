import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

/** How a key appears in a list — never the token itself. */
export interface McpKeyView {
  id: string;
  label: string;
  /** Leading characters, so two keys can be told apart. Not a secret. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** The one and only time the token is returned. */
export interface McpKeyCreated extends McpKeyView {
  token: string;
}

/**
 * Recognisable at a glance, and greppable in a support conversation without
 * anyone wondering what kind of secret they are looking at.
 */
const TOKEN_PREFIX = 'rmk_';
const TOKEN_BYTES = 32;
const PREFIX_SHOWN = 8;

/**
 * Personal MCP credentials.
 *
 * Replaces a single shared bearer token, which had two problems: every write
 * through an assistant was attributed to the owner, and revoking access for one
 * person meant rotating the token for everybody.
 *
 * Tokens are stored only as SHA-256. That is sufficient here — unlike a password,
 * this is 32 bytes of CSPRNG output, so there is no dictionary to attack and a
 * slow KDF would buy nothing but latency on every MCP call.
 */
@Injectable()
export class McpKeyService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async list(userId: string): Promise<McpKeyView[]> {
    const rows = await this.prisma.mcpApiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * Mint a key and return it once.
   *
   * The caller must show it immediately, because nothing can retrieve it again.
   * That is the point: a lost key is replaced, not recovered.
   */
  async create(userId: string, label: string): Promise<McpKeyCreated> {
    const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url');
    const row = await this.prisma.mcpApiKey.create({
      data: {
        userId,
        label,
        tokenHash: this.hash(token),
        prefix: token.slice(0, TOKEN_PREFIX.length + PREFIX_SHOWN),
      },
    });
    return { ...this.toView(row), token };
  }

  /**
   * Revoke rather than delete.
   *
   * A key that disappears from the list looks like one that was never created,
   * which is a confusing thing to see after you have just revoked it. Scoped to
   * the owner, so another account's id is a 404.
   */
  async revoke(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.mcpApiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException(`No active MCP key ${id}`);
    }
  }

  /**
   * Resolve a presented token to its owner, or null.
   *
   * Returns the cached contribution flag alongside the user, because an MCP
   * caller has no JWT and so no `apps` claim to consult — see the note on
   * `User.canContribute`.
   *
   * `lastUsedAt` is updated as a side effect. It is the only way someone can
   * recognise a key they have forgotten about, and it is what makes "revoke the
   * one I stopped using" a decision they can actually make.
   */
  async resolve(
    token: string,
  ): Promise<{ userId: string; canContribute: boolean } | null> {
    if (!token.startsWith(TOKEN_PREFIX)) {
      return null;
    }
    const row = await this.prisma.mcpApiKey.findUnique({
      where: { tokenHash: this.hash(token) },
      select: {
        id: true,
        revokedAt: true,
        userId: true,
        user: { select: { canContribute: true } },
      },
    });
    if (!row || row.revokedAt !== null) {
      return null;
    }

    // Fire and forget: a failed bookkeeping write must not fail the request the
    // user actually made.
    void this.prisma.mcpApiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { userId: row.userId, canContribute: row.user.canContribute };
  }

  private toView(row: {
    id: string;
    label: string;
    prefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
  }): McpKeyView {
    return {
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }
}
