import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  normaliseStars,
  summariseReactions,
  NO_REACTIONS,
  type RecipeReactionSummary,
} from './recipe-reaction.js';
import { visibilityWhere, type RecipeViewer } from './recipe-visibility.js';
import { RecipeVisibilityService } from './recipe-visibility.service.js';

/**
 * Writing what one cook thinks of one recipe.
 *
 * Reads live in the repository, alongside the recipe they decorate. Writes live
 * here because they answer a different question — may this person react to this
 * recipe at all — and that check is the whole reason this is a service rather
 * than two lines in the controller.
 */
@Injectable()
export class RecipeReactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: RecipeVisibilityService,
  ) {}

  /** Like it, or take the like back. */
  async setLike(
    userId: string,
    recipeId: string,
    liked: boolean,
  ): Promise<RecipeReactionSummary> {
    const viewer = await this.viewerFor(userId);
    await this.assertReadable(viewer, recipeId);

    await this.prisma.recipeReaction.upsert({
      where: { recipeId_userId: { recipeId, userId } },
      // Only the like. A create needs the whole row, but an update must leave
      // `stars` exactly as it was: liking a recipe is not a reason to forget
      // the score its author already gave it.
      create: { recipeId, userId, liked },
      update: { liked },
    });

    return this.summaryFor(viewer, recipeId);
  }

  /**
   * Score it out of five, or clear the score with 0.
   *
   * Clearing writes NULL rather than deleting the row, which would take the
   * like with it.
   */
  async setStars(
    userId: string,
    recipeId: string,
    stars: number,
  ): Promise<RecipeReactionSummary> {
    let value: number | null;
    try {
      value = normaliseStars(stars);
    } catch (error) {
      // A score off the scale is a malformed request, not a server fault.
      throw new BadRequestException(
        error instanceof Error ? error.message : 'invalid stars',
      );
    }

    const viewer = await this.viewerFor(userId);
    await this.assertReadable(viewer, recipeId);

    await this.prisma.recipeReaction.upsert({
      where: { recipeId_userId: { recipeId, userId } },
      create: { recipeId, userId, stars: value },
      update: { stars: value },
    });

    return this.summaryFor(viewer, recipeId);
  }

  /**
   * The kitchens this person's reaction is judged against.
   *
   * `forUser` returns null only for a missing id, and every caller here is past
   * an auth guard — so a null means the guard was bypassed, not that a guest
   * arrived. Refusing is the safe reading.
   */
  private async viewerFor(userId: string): Promise<RecipeViewer> {
    const viewer = await this.visibility.forUser(userId);
    if (!viewer) {
      throw new BadRequestException('a reaction needs a signed-in cook');
    }
    return viewer;
  }

  /**
   * Refuse a reaction to a recipe the caller cannot read.
   *
   * Reuses the read visibility rule rather than restating it: without this, a
   * stranger could rate — and so learn the existence of — a private recipe by
   * POSTing an id they guessed. NotFound rather than Forbidden, matching the
   * read path, so the answer does not confirm the id exists.
   */
  private async assertReadable(
    viewer: RecipeViewer,
    recipeId: string,
  ): Promise<void> {
    const found = await this.prisma.recipe.findFirst({
      where: { AND: [{ id: recipeId }, visibilityWhere(viewer)] },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`recipes with id ${recipeId} not found`);
    }
  }

  /** The recipe's totals as they now stand, so the client need not re-fetch. */
  private async summaryFor(
    viewer: RecipeViewer,
    recipeId: string,
  ): Promise<RecipeReactionSummary> {
    const rows = await this.prisma.recipeReaction.findMany({
      where: { recipeId },
      select: { recipeId: true, userId: true, liked: true, stars: true },
    });

    return (
      summariseReactions(rows, viewer.userId).get(recipeId) ?? NO_REACTIONS
    );
  }
}
