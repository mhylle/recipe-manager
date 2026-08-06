import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** A person, as the owner needs to see them to decide about access. */
export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  /** Granted here, on the admin page. The owner controls this one. */
  localContributor: boolean;
  /**
   * Last seen in their token — the auth-service's `apps` grant. Read-only here,
   * and shown so it is obvious when someone already has access by that route and
   * needs nothing from this page.
   */
  appGrant: boolean;
  /** What the guards will actually decide. The OR of the two above. */
  canContribute: boolean;
  /** How many recipes they have added, so the list has some context. */
  recipeCount: number;
}

/**
 * Who may add to the shared recipe library.
 *
 * Only the owner reaches this — see OwnerGuard. The grant it writes is local to
 * this app and takes effect on the person's very next request, which is the
 * point: granting via the auth-service waits for their next sign-in, and longer
 * still for an MCP key.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everyone with an account, newest first.
   *
   * Newest first because the person you are looking for has almost always just
   * registered and asked you for access.
   */
  async listUsers(): Promise<AdminUserView[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        localContributor: true,
        canContribute: true,
        _count: { select: { createdRecipes: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      localContributor: user.localContributor,
      appGrant: user.canContribute,
      canContribute: user.localContributor || user.canContribute,
      recipeCount: user._count.createdRecipes,
    }));
  }

  /**
   * Allow or withdraw contribution for one person.
   *
   * Withdrawing clears only the LOCAL grant. If they also hold the
   * `recipe-manager` app in the auth-service they keep access, and the list says
   * so — silently appearing not to work would be worse than showing why.
   */
  async setContributor(
    userId: string,
    granted: boolean,
  ): Promise<AdminUserView> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { localContributor: granted },
    });
    if (count === 0) {
      throw new NotFoundException(`No user ${userId}`);
    }

    const users = await this.listUsers();
    const updated = users.find((user) => user.id === userId);
    if (!updated) {
      throw new NotFoundException(`No user ${userId}`);
    }
    return updated;
  }
}
