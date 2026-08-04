import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** The subset of SSO claims that identifies and describes a person. */
export interface SsoClaims {
  sub: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export interface LocalUser {
  id: string;
  ssoSubject: string;
  email: string;
  displayName: string;
}

/**
 * What to show for a person, in order of preference.
 *
 * Falls back to the email rather than an empty string — a blank byline on a
 * recipe reads as a rendering bug, where an address at least identifies someone.
 */
function displayNameFrom(claims: SsoClaims): string {
  if (claims.name?.trim()) {
    return claims.name.trim();
  }
  const composed = [claims.firstName, claims.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();
  return composed || claims.email;
}

/**
 * Resolves an authenticated caller to a local row.
 *
 * Provisioning is just-in-time: the first authenticated request from a subject
 * creates the row, and every later one refreshes the cached display fields.
 * There is no registration step and no sync job, so a valid token always yields
 * a usable local user.
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveFromClaims(claims: SsoClaims): Promise<LocalUser> {
    const data = { email: claims.email, displayName: displayNameFrom(claims) };

    try {
      return await this.prisma.user.upsert({
        where: { ssoSubject: claims.sub },
        create: { ssoSubject: claims.sub, ...data },
        update: data,
      });
    } catch (error) {
      // Two concurrent first-requests from one subject — both miss the read,
      // both insert, one loses on the unique index. The loser must return the
      // winner's row; a 500 on someone's very first login is not acceptable.
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }
      const winner = await this.prisma.user.findUnique({
        where: { ssoSubject: claims.sub },
      });
      if (!winner) {
        throw error;
      }
      return winner;
    }
  }

  /**
   * The identity the MCP server acts as.
   *
   * Deliberately requires an existing row rather than creating one. The value is
   * an SSO subject we cannot describe without reaching into auth_db, so
   * inventing a row would turn a typo'd subject into a ghost user silently
   * owning production writes. Failing here surfaces the misconfiguration on the
   * first request instead.
   */
  async resolveServiceUser(): Promise<LocalUser> {
    const subject = process.env.RECIPE_MANAGER_SERVICE_USER;
    if (!subject) {
      throw new UnauthorizedException(
        'RECIPE_MANAGER_SERVICE_USER is not configured; refusing an unattributed write.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { ssoSubject: subject } });
    if (!user) {
      throw new UnauthorizedException(
        'RECIPE_MANAGER_SERVICE_USER does not match any known user.',
      );
    }
    return user;
  }
}
