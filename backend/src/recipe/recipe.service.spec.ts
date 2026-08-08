/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { RecipeRepository } from './recipe.repository';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { RecipeImageService } from './recipe-image.service';
import { ThumbnailService } from './thumbnail.service';
import { Recipe } from '../shared/interfaces/recipe.interface';
import { Unit } from '../shared/enums/unit.enum';
import { Difficulty } from '../shared/enums/difficulty.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';
import { RecipeVisibilityService } from './recipe-visibility.service';
import { PantryAccessService } from '../pantry/pantry-access.service';

describe('RecipeService', () => {
  let service: RecipeService;
  let repository: jest.Mocked<RecipeRepository>;
  let imageGeneration: {
    generateHeroImage: jest.Mock;
    generateStepImages: jest.Mock;
  };
  let recipeImages: { store: jest.Mock };
  let thumbnails: { generate: jest.Mock };

  const mockRecipe: Recipe = {
    id: 'recipe-uuid-1',
    name: 'Pancakes',
    description: 'Fluffy breakfast pancakes',
    servings: 4,
    instructions: [
      'Mix dry ingredients',
      'Add wet ingredients',
      'Cook on griddle',
    ],
    ingredients: [
      {
        name: 'Flour',
        quantity: 200,
        unit: Unit.G,
        pantryCategory: PantryCategory.BAKING,
      },
      {
        name: 'Milk',
        quantity: 300,
        unit: Unit.ML,
        pantryCategory: PantryCategory.DAIRY,
      },
      {
        name: 'Eggs',
        quantity: 2,
        unit: Unit.PIECE,
        pantryCategory: PantryCategory.DAIRY,
      },
    ],
    prepTime: 10,
    cookTime: 15,
    difficulty: Difficulty.EASY,
    tags: ['breakfast', 'quick'],
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      // Ownership is checked before every write; the caller in these
      // tests is the recipe's author.
      findOwner: jest
        .fn()
        .mockResolvedValue({ createdById: 'u-martin', pantryId: null }),
      update: jest.fn(),
      delete: jest.fn(),
    };

    thumbnails = {
      generate: jest
        .fn()
        .mockResolvedValue('/api/recipe-manager/images/recipes/thumbs/x.webp'),
    };

    recipeImages = {
      store: jest
        .fn()
        .mockReturnValue('/api/recipe-manager/images/recipes/x_upload1.png'),
    };

    imageGeneration = {
      generateHeroImage: jest.fn().mockResolvedValue(null),
      generateStepImages: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: RecipeRepository, useValue: mockRepository },
        // Stubbed so tests exercise persistence only and never reach a real
        // image backend. There is no isEnabled() any more: generation is not a
        // server capability that can be switched on, it is something a caller
        // pays for with their own key.
        {
          provide: ImageGenerationService,
          useValue: imageGeneration,
        },
        // Upload writes to disk, which these tests have no business doing.
        { provide: RecipeImageService, useValue: recipeImages },
        // Writes files and shells out to libvips; neither belongs in these tests.
        { provide: ThumbnailService, useValue: thumbnails },
        // Only transferAuthor consults it; covered in recipe-transfer.spec.ts.
        {
          provide: PantryAccessService,
          useValue: { shareAKitchen: jest.fn().mockResolvedValue(false) },
        },
        // The membership lookup behind "who may read this". Stubbed to a viewer
        // with no kitchens: these tests are about delegation, and the policy
        // itself is covered in recipe-visibility.spec.ts.
        {
          provide: RecipeVisibilityService,
          useValue: {
            forUser: jest.fn((userId?: string) =>
              Promise.resolve(userId ? { userId, pantryIds: [] } : null),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
    repository = module.get(RecipeRepository);
  });

  describe('create', () => {
    it('should delegate to repository and return created recipe', async () => {
      repository.create.mockResolvedValue(mockRecipe);

      const dto = {
        name: 'Pancakes',
        description: 'Fluffy breakfast pancakes',
        servings: 4,
        instructions: [
          'Mix dry ingredients',
          'Add wet ingredients',
          'Cook on griddle',
        ],
        ingredients: [
          {
            name: 'Flour',
            quantity: 200,
            unit: Unit.G,
            pantryCategory: PantryCategory.BAKING,
          },
          {
            name: 'Milk',
            quantity: 300,
            unit: Unit.ML,
            pantryCategory: PantryCategory.DAIRY,
          },
          {
            name: 'Eggs',
            quantity: 2,
            unit: Unit.PIECE,
            pantryCategory: PantryCategory.DAIRY,
          },
        ],
        prepTime: 10,
        cookTime: 15,
        difficulty: Difficulty.EASY,
        tags: ['breakfast', 'quick'],
      };

      const result = await service.create('u-martin', dto);

      expect(repository.create).toHaveBeenCalledWith('u-martin', dto, {
        sourceLocale: 'en',
        translations: undefined,
      });
      expect(result).toEqual(mockRecipe);
      expect(result.id).toBeDefined();
      expect(result.ingredients).toHaveLength(3);
    });
    it('never spends anyone\u2019s Gemini quota on create', async () => {
      // There is no shared key, so there is no credential at create time and
      // nothing to charge. Generation is an explicit, key-bearing action.
      repository.create.mockResolvedValue(mockRecipe);

      await service.create('user-1', {
        name: 'Pancakes',
        description: 'Fluffy breakfast pancakes',
        servings: 4,
        instructions: ['Mix', 'Cook'],
        ingredients: [],
        prepTime: 5,
        cookTime: 10,
        difficulty: Difficulty.EASY,
        tags: [],
      });

      expect(imageGeneration.generateHeroImage).not.toHaveBeenCalled();
      expect(imageGeneration.generateStepImages).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all recipes from repository', async () => {
      const recipes = [
        mockRecipe,
        { ...mockRecipe, id: 'recipe-uuid-2', name: 'Omelette' },
      ];
      repository.findAll.mockResolvedValue({
        data: recipes,
        total: 2,
        limit: 100,
        offset: 0,
      });

      const result = await service.findAllFor('u-martin');

      expect(repository.findAll).toHaveBeenCalled();
      expect(result.data).toEqual(recipes);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty array when no recipes exist', async () => {
      repository.findAll.mockResolvedValue({
        data: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      const result = await service.findAllFor('u-martin');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return recipe when found', async () => {
      repository.findById.mockResolvedValue(mockRecipe);

      const result = await service.findByIdFor('u-martin', 'recipe-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith(
        'recipe-uuid-1',
        'en',
        { userId: 'u-martin', pantryIds: [] },
        undefined,
      );
      expect(result).toEqual(mockRecipe);
    });

    it('should throw NotFoundException when recipe not found', async () => {
      repository.findById.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(
        service.findByIdFor('u-martin', 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should delegate to repository with updated fields', async () => {
      const updatedRecipe = {
        ...mockRecipe,
        name: 'Blueberry Pancakes',
        ingredients: [
          ...mockRecipe.ingredients,
          {
            name: 'Blueberries',
            quantity: 100,
            unit: Unit.G,
            pantryCategory: PantryCategory.PRODUCE,
          },
        ],
      };
      repository.update.mockResolvedValue(updatedRecipe);

      const result = await service.update('recipe-uuid-1', 'u-martin', {
        name: 'Blueberry Pancakes',
        ingredients: updatedRecipe.ingredients,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'recipe-uuid-1',
        {
          name: 'Blueberry Pancakes',
          ingredients: updatedRecipe.ingredients,
        },
        {
          locale: 'en',
          translations: undefined,
        },
      );
      expect(result.name).toBe('Blueberry Pancakes');
      expect(result.ingredients).toHaveLength(4);
    });

    it('should allow removing ingredients via update', async () => {
      const updatedRecipe = {
        ...mockRecipe,
        ingredients: [mockRecipe.ingredients[0]],
      };
      repository.update.mockResolvedValue(updatedRecipe);

      const result = await service.update('recipe-uuid-1', 'u-martin', {
        ingredients: [mockRecipe.ingredients[0]],
      });

      expect(result.ingredients).toHaveLength(1);
    });

    it('should throw NotFoundException when updating non-existent recipe', async () => {
      repository.update.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(
        service.update('missing-id', 'u-martin', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delegate to repository', async () => {
      repository.delete.mockResolvedValue(undefined);

      await service.delete('recipe-uuid-1', 'u-martin');

      expect(repository.delete).toHaveBeenCalledWith('recipe-uuid-1');
    });

    it('should throw NotFoundException when deleting non-existent recipe', async () => {
      repository.delete.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(service.delete('missing-id', 'u-martin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  describe('regenerateImages', () => {
    it('forwards the CALLER\u2019s key, so one user cannot spend another\u2019s quota', async () => {
      repository.findOwner.mockResolvedValue({
        createdById: 'user-1',
        pantryId: null,
      });
      repository.findById.mockResolvedValue(mockRecipe);

      await service.regenerateImages(
        'recipe-1',
        'user-1',
        'caller-supplied-key',
      );
      // Generation is fire-and-forget; let the detached promise run.
      await new Promise((r) => setImmediate(r));

      expect(imageGeneration.generateHeroImage).toHaveBeenCalledWith(
        expect.anything(),
        'caller-supplied-key',
      );
      expect(imageGeneration.generateStepImages).toHaveBeenCalledWith(
        expect.anything(),
        'caller-supplied-key',
      );
    });
  });

  describe('thumbnails', () => {
    it('makes one when a photograph is uploaded', async () => {
      repository.findOwner.mockResolvedValue({
        createdById: 'user-1',
        pantryId: null,
      });
      repository.update.mockResolvedValue(mockRecipe);

      await service.uploadImage('recipe-1', 'user-1', {
        buffer: Buffer.from('x'),
        size: 1,
      });

      expect(thumbnails.generate).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        'recipe-1',
        expect.objectContaining({
          thumbnailUrl: '/api/recipe-manager/images/recipes/thumbs/x.webp',
        }),
      );
    });

    it('makes one when an image is generated', async () => {
      repository.findOwner.mockResolvedValue({
        createdById: 'user-1',
        pantryId: null,
      });
      repository.findById.mockResolvedValue(mockRecipe);
      imageGeneration.generateHeroImage.mockResolvedValue(
        '/api/recipe-manager/images/recipes/hero.png',
      );

      await service.regenerateImages('recipe-1', 'user-1', 'a-key');
      await new Promise((r) => setImmediate(r));

      expect(thumbnails.generate).toHaveBeenCalledWith(
        '/api/recipe-manager/images/recipes/hero.png',
      );
    });

    it('still saves the image when thumbnailing fails', async () => {
      // Null means "use the full image", which is what happened before
      // thumbnails existed — a failure degrades to slow, not to broken.
      thumbnails.generate.mockResolvedValue(null);
      repository.findOwner.mockResolvedValue({
        createdById: 'user-1',
        pantryId: null,
      });
      repository.update.mockResolvedValue(mockRecipe);

      await service.uploadImage('recipe-1', 'user-1', {
        buffer: Buffer.from('x'),
        size: 1,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'recipe-1',
        expect.objectContaining({ thumbnailUrl: undefined }),
      );
    });
  });
});
