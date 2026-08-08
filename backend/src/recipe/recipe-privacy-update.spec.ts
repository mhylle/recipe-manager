import { RecipeService } from './recipe.service';
import { RecipeRepository } from './recipe.repository';
import { RecipeVisibilityService } from './recipe-visibility.service';
import { RecipeImageService } from './recipe-image.service';
import { ThumbnailService } from './thumbnail.service';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { PantryAccessService } from '../pantry/pantry-access.service';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Turning privacy ON for a recipe that already existed.
 *
 * This is the path #65 came in on, and the one the original change never
 * exercised: the create path sets `pantryId`, the visibility rule was tested
 * directly, and the gap between them — an existing recipe, edited — went
 * unchecked. Every recipe predating the migration has a NULL `pantryId`, so
 * making one private pinned it to no kitchen and left it visible to its author
 * alone.
 */
describe('RecipeService.update — becoming private', () => {
  let service: RecipeService;
  let repository: { findOwner: jest.Mock; update: jest.Mock };

  const AUTHOR = 'u-martin';
  const RECIPE = 'r-cheesecake';
  const KITCHEN = 'p-home';

  const build = async (existingPantryId: string | null) => {
    repository = {
      findOwner: jest
        .fn()
        .mockResolvedValue({ createdById: AUTHOR, pantryId: existingPantryId }),
      update: jest.fn().mockResolvedValue({ id: RECIPE }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: RecipeRepository, useValue: repository },
        { provide: ImageGenerationService, useValue: {} },
        { provide: RecipeImageService, useValue: {} },
        { provide: ThumbnailService, useValue: {} },
        { provide: RecipeVisibilityService, useValue: { forUser: jest.fn() } },
        { provide: PantryAccessService, useValue: {} },
      ],
    }).compile();

    service = module.get(RecipeService);
  };

  /**
   * The PAYLOAD the repository was handed — `data`, not the options bag.
   *
   * Asserting on the right argument is the whole point here. An earlier cut
   * passed pantryId as an option, which the repository never reads, and a test
   * that inspected the options object went green on a change that did nothing.
   */
  const payloadOf = (): { pantryId?: string | null } => {
    const [, payload] = repository.update.mock.calls[0] as [
      string,
      { pantryId?: string | null },
      unknown,
    ];
    return payload;
  };

  describe('a recipe written before kitchens were recorded', () => {
    it('pins it to the caller’s kitchen, so the household can see it', async () => {
      // The bug: without this the recipe keeps pantryId NULL, the visibility
      // rule's kitchen arm can never match, and only the author sees it.
      await build(null);

      await service.update(
        RECIPE,
        AUTHOR,
        { isPrivate: true },
        'en',
        undefined,
        undefined,
        KITCHEN,
      );

      expect(payloadOf().pantryId).toBe(KITCHEN);
    });

    it('leaves it unpinned when the author has no kitchen at all', async () => {
      // Author-only is the correct answer here — there is no household to
      // narrow to, and falling back to public would leak it.
      await build(null);

      await service.update(
        RECIPE,
        AUTHOR,
        { isPrivate: true },
        'en',
        undefined,
        undefined,
        null,
      );

      expect(payloadOf().pantryId).toBeUndefined();
    });
  });

  describe('a recipe that already belongs to a kitchen', () => {
    it('does not move it to whichever kitchen is on screen', async () => {
      // The distractor: always writing the caller's kitchen would pass the
      // first test and silently relocate a recipe filed in the summerhouse
      // because the cook happened to be viewing home.
      await build('p-summerhouse');

      await service.update(
        RECIPE,
        AUTHOR,
        { isPrivate: true },
        'en',
        undefined,
        undefined,
        KITCHEN,
      );

      expect(payloadOf().pantryId).toBeUndefined();
    });
  });

  describe('edits that are not about privacy', () => {
    it('does not pin a recipe just because it was edited', async () => {
      await build(null);

      await service.update(
        RECIPE,
        AUTHOR,
        { servings: 6 },
        'en',
        undefined,
        undefined,
        KITCHEN,
      );

      expect(payloadOf().pantryId).toBeUndefined();
    });

    it('does not pin one that is being made public again', async () => {
      await build(null);

      await service.update(
        RECIPE,
        AUTHOR,
        { isPrivate: false },
        'en',
        undefined,
        undefined,
        KITCHEN,
      );

      expect(payloadOf().pantryId).toBeUndefined();
    });
  });
});
