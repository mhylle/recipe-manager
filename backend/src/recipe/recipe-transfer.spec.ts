import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecipeService } from './recipe.service';
import { RecipeRepository } from './recipe.repository';
import { RecipeVisibilityService } from './recipe-visibility.service';
import { RecipeImageService } from './recipe-image.service';
import { ThumbnailService } from './thumbnail.service';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { PantryAccessService } from '../pantry/pantry-access.service';

/**
 * Handing a recipe to the person who actually cooked it.
 *
 * Attribution is not decoration here: `createdById` is what `assertCanModify`
 * checks on every write, and it is one arm of the private-recipe visibility
 * rule. So transferring is a permission change, and these tests are mostly
 * about who is allowed to make it and to whom.
 */
describe('RecipeService.transferAuthor', () => {
  let service: RecipeService;
  let repository: {
    findOwner: jest.Mock;
    reassignAuthor: jest.Mock;
    findById: jest.Mock;
  };
  let pantryAccess: { shareAKitchen: jest.Mock };

  const RECIPE = 'r-cheesecake';
  const AUTHOR = 'u-martin';
  const HOUSEMATE = 'u-heidi';
  const STRANGER = 'u-stranger';

  beforeEach(async () => {
    repository = {
      findOwner: jest.fn().mockResolvedValue({ createdById: AUTHOR }),
      reassignAuthor: jest.fn().mockResolvedValue({ id: RECIPE }),
      findById: jest.fn(),
    };
    pantryAccess = {
      // Heidi cooks with Martin; the stranger does not.
      shareAKitchen: jest
        .fn()
        .mockImplementation((_a: string, b: string) =>
          Promise.resolve(b === HOUSEMATE),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: RecipeRepository, useValue: repository },
        { provide: PantryAccessService, useValue: pantryAccess },
        { provide: ImageGenerationService, useValue: {} },
        { provide: RecipeImageService, useValue: {} },
        { provide: ThumbnailService, useValue: {} },
        { provide: RecipeVisibilityService, useValue: { forUser: jest.fn() } },
      ],
    }).compile();

    service = module.get(RecipeService);
  });

  it('hands the recipe to someone you share a kitchen with', () => {
    // The distractor: an implementation that refused everything would pass
    // every negative case below and never transfer anything.
    return expect(
      service.transferAuthor(RECIPE, AUTHOR, HOUSEMATE),
    ).resolves.toBeDefined();
  });

  it('records the new author', async () => {
    await service.transferAuthor(RECIPE, AUTHOR, HOUSEMATE);

    expect(repository.reassignAuthor).toHaveBeenCalledWith(RECIPE, HOUSEMATE);
  });

  it('refuses when the caller is not the author', async () => {
    // Attribution is a permission, so giving it away has to be gated the same
    // way editing is — otherwise anyone could reassign someone else's recipe.
    await expect(
      service.transferAuthor(RECIPE, 'u-someone-else', HOUSEMATE),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.reassignAuthor).not.toHaveBeenCalled();
  });

  it('refuses a recipient you share no kitchen with', async () => {
    await expect(
      service.transferAuthor(RECIPE, AUTHOR, STRANGER),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.reassignAuthor).not.toHaveBeenCalled();
  });

  it('refuses to transfer a recipe to yourself', async () => {
    // A no-op that reports success invites the reading that something moved.
    await expect(
      service.transferAuthor(RECIPE, AUTHOR, AUTHOR),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.reassignAuthor).not.toHaveBeenCalled();
  });

  it('404s a recipe that does not exist', async () => {
    repository.findOwner.mockResolvedValue(null);

    await expect(
      service.transferAuthor('r-missing', AUTHOR, HOUSEMATE),
    ).rejects.toThrow(NotFoundException);
  });

  it('checks ownership before it checks the recipient', async () => {
    // Otherwise a stranger probing recipe ids learns which users share a
    // kitchen with them from the difference in error.
    await expect(
      service.transferAuthor(RECIPE, 'u-someone-else', STRANGER),
    ).rejects.toThrow(ForbiddenException);
    expect(pantryAccess.shareAKitchen).not.toHaveBeenCalled();
  });
});
