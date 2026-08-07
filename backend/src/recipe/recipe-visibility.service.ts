import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RecipeViewer } from './recipe-visibility.js';

/**
 * Resolves the caller into the kitchens a recipe read is judged against.
 *
 * Every kitchen they belong to, deliberately — not the one currently selected
 * in the UI. Which kitchen is on screen is a view preference; whether a recipe
 * is theirs to read is not, and a recipe private to the summerhouse should not
 * vanish because someone is looking at the home pantry.
 */
@Injectable()
export class RecipeVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** `undefined` in, `null` out: a guest, who sees the shared library only. */
  async forUser(userId: string | undefined): Promise<RecipeViewer | null> {
    if (!userId) {
      return null;
    }

    const memberships = await this.prisma.pantryMember.findMany({
      where: { userId },
      select: { pantryId: true },
    });

    // An empty list is not the same as null. Someone who has signed in but has
    // no kitchen yet must still see their own private recipes.
    return { userId, pantryIds: memberships.map((m) => m.pantryId) };
  }
}
