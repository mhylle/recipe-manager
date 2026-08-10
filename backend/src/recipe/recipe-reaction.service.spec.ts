import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RecipeReactionService } from './recipe-reaction.service';
import { RecipeVisibilityService } from './recipe-visibility.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RecipeReactionService', () => {
  let service: RecipeReactionService;
  let prisma: {
    recipe: { findFirst: jest.Mock };
    recipeReaction: { upsert: jest.Mock; findMany: jest.Mock };
  };
  let visibility: { forUser: jest.Mock };

  beforeEach(async () => {
    prisma = {
      // Readable by default; the refusal cases override it.
      recipe: { findFirst: jest.fn().mockResolvedValue({ id: 'r1' }) },
      recipeReaction: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    visibility = {
      forUser: jest
        .fn()
        .mockResolvedValue({ userId: 'u-me', pantryIds: ['p1'] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        RecipeReactionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecipeVisibilityService, useValue: visibility },
      ],
    }).compile();

    service = module.get(RecipeReactionService);
  });

  describe('setLike', () => {
    it('upserts the like against this cook and this recipe', async () => {
      await service.setLike('u-me', 'r1', true);

      expect(prisma.recipeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipeId_userId: { recipeId: 'r1', userId: 'u-me' } },
          create: { recipeId: 'r1', userId: 'u-me', liked: true },
          update: { liked: true },
        }),
      );
    });

    it('leaves an existing rating alone', async () => {
      await service.setLike('u-me', 'r1', true);

      // The update must not mention stars. Writing the whole row here is how a
      // cook's 5-star verdict would silently vanish the moment they tapped the
      // heart on their own recipe.
      const calls = prisma.recipeReaction.upsert.mock.calls as [
        { update: Record<string, unknown> },
      ][];
      expect(calls[0][0].update).not.toHaveProperty('stars');
    });

    it('takes a like back without deleting the row', async () => {
      await service.setLike('u-me', 'r1', false);

      expect(prisma.recipeReaction.upsert).toHaveBeenCalled();
      // No delete anywhere: the row still carries the rating.
      expect(prisma.recipeReaction).not.toHaveProperty('delete');
    });
  });

  describe('setStars', () => {
    it('stores a score on the scale', async () => {
      await service.setStars('u-me', 'r1', 4);

      expect(prisma.recipeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { stars: 4 },
        }),
      );
    });

    it('stores a null when the score is cleared with 0', async () => {
      await service.setStars('u-me', 'r1', 0);

      expect(prisma.recipeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { stars: null } }),
      );
    });

    it('leaves an existing like alone', async () => {
      await service.setStars('u-me', 'r1', 4);

      const calls = prisma.recipeReaction.upsert.mock.calls as [
        { update: Record<string, unknown> },
      ][];
      expect(calls[0][0].update).not.toHaveProperty('liked');
    });

    it('refuses a score off the scale as a bad request', async () => {
      await expect(service.setStars('u-me', 'r1', 9)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.recipeReaction.upsert).not.toHaveBeenCalled();
    });

    it('checks the scale before it checks the recipe', async () => {
      // Cheaper, and it keeps the error about the thing that is actually wrong.
      await expect(service.setStars('u-me', 'r1', 9)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.recipe.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('a recipe the caller cannot read', () => {
    beforeEach(() => {
      prisma.recipe.findFirst.mockResolvedValue(null);
    });

    it('refuses a like', async () => {
      await expect(service.setLike('u-me', 'r-private', true)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.recipeReaction.upsert).not.toHaveBeenCalled();
    });

    it('refuses a rating', async () => {
      await expect(service.setStars('u-me', 'r-private', 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.recipeReaction.upsert).not.toHaveBeenCalled();
    });

    it('says "not found" rather than "not yours"', async () => {
      // Refusing by name would confirm the id exists to whoever guessed it.
      await expect(service.setLike('u-me', 'r-private', true)).rejects.toThrow(
        /not found/,
      );
    });

    it('judges readability against every kitchen the cook is in', async () => {
      await service.setLike('u-me', 'r1', true).catch(() => undefined);

      expect(visibility.forUser).toHaveBeenCalledWith('u-me');
    });
  });

  describe('the summary it answers with', () => {
    it('reports the totals as they now stand, including the caller’s own', async () => {
      prisma.recipeReaction.findMany.mockResolvedValue([
        { recipeId: 'r1', userId: 'u-me', liked: true, stars: 4 },
        { recipeId: 'r1', userId: 'u-other', liked: false, stars: 2 },
      ]);

      const summary = await service.setLike('u-me', 'r1', true);

      expect(summary).toEqual({
        likeCount: 1,
        ratingCount: 2,
        ratingAverage: 3,
        likedByMe: true,
        myStars: 4,
      });
    });

    it('answers with an empty summary when the row it just wrote is gone', async () => {
      prisma.recipeReaction.findMany.mockResolvedValue([]);

      const summary = await service.setLike('u-me', 'r1', false);

      expect(summary).toEqual({
        likeCount: 0,
        ratingCount: 0,
        ratingAverage: null,
        likedByMe: false,
        myStars: null,
      });
    });
  });
});
