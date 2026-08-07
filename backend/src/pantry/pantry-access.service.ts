import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LocalUser } from '../shared/auth/user.service.js';

export interface PantrySummary {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  memberCount: number;
}

/**
 * Decides which kitchen a request is allowed to touch.
 *
 * Every pantry-scoped query goes through here. The rule it exists to enforce:
 * a pantry id supplied by the caller is an INPUT, not a permission — it must be
 * checked against the caller's memberships before anything reads or writes with
 * it. Skipping that turns every pantry endpoint into "show me any household's
 * kitchen if I can guess a uuid".
 */
@Injectable()
export class PantryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The pantry this request operates on.
   *
   * With an explicit id, membership is verified. Without one, the caller's
   * default pantry is used — the one they own, else the one they joined first,
   * so a household member with no pantry of their own still lands somewhere
   * sensible instead of getting an error.
   */
  /**
   * Whether two people cook together in at least one kitchen.
   *
   * The test for handing something to somebody — transferring a recipe, so far.
   * Sharing a kitchen is the app's existing answer to "do these two know each
   * other", and using it means no user directory has to be exposed to make the
   * recipient pickable: you can only give a recipe to someone you already share
   * a household with.
   */
  async shareAKitchen(userId: string, otherUserId: string): Promise<boolean> {
    if (userId === otherUserId) {
      return false;
    }
    const shared = await this.prisma.pantryMember.findFirst({
      where: {
        userId: otherUserId,
        pantry: { members: { some: { userId } } },
      },
      select: { id: true },
    });
    return shared !== null;
  }

  async resolve(user: LocalUser, requestedPantryId?: string): Promise<string> {
    if (requestedPantryId) {
      const membership = await this.prisma.pantryMember.findUnique({
        where: {
          pantryId_userId: { pantryId: requestedPantryId, userId: user.id },
        },
      });
      if (!membership) {
        // 403, not 404 and not an empty list. An empty list would look like a
        // working feature while the check was missing, and is exactly how this
        // class of hole survives review.
        throw new ForbiddenException('You are not a member of that pantry.');
      }
      return requestedPantryId;
    }

    const memberships = await this.prisma.pantryMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
    });

    if (memberships.length === 0) {
      throw new NotFoundException(
        'You do not belong to a pantry yet. Create one, or ask someone to share theirs.',
      );
    }
    // Owned wins regardless of join order — otherwise someone's default kitchen
    // depends on the order they happened to be invited to other people's.
    const owned = memberships.find((m) => m.role === 'owner');
    return (owned ?? memberships[0]).pantryId;
  }

  /** Every kitchen this user belongs to, for the switcher and the sharing UI. */
  async listForUser(user: LocalUser): Promise<PantrySummary[]> {
    const memberships = await this.prisma.pantryMember.findMany({
      where: { userId: user.id },
      include: {
        pantry: { include: { _count: { select: { members: true } } } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.pantryId,
      name: m.pantry.name,
      role: m.role,
      isOwner: m.role === 'owner',
      memberCount: m.pantry._count.members,
    }));
  }

  /**
   * Create a kitchen for someone who has none.
   *
   * Called on first use rather than at sign-up: a user who never opens the
   * pantry never needs one, and provisioning eagerly would litter the table
   * with empty kitchens for anyone who merely browsed the recipes.
   */
  async createFor(user: LocalUser, name: string): Promise<string> {
    const pantry = await this.prisma.pantry.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'owner' } },
        staples: { create: { items: [] } },
      },
    });
    return pantry.id;
  }
}
