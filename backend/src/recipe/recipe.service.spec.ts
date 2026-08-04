/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { RecipeRepository } from './recipe.repository';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { Recipe } from '../shared/interfaces/recipe.interface';
import { Unit } from '../shared/enums/unit.enum';
import { Difficulty } from '../shared/enums/difficulty.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';

describe('RecipeService', () => {
  let service: RecipeService;
  let repository: jest.Mocked<RecipeRepository>;

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
      findOwner: jest.fn().mockResolvedValue({ createdById: 'u-martin' }),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: RecipeRepository, useValue: mockRepository },
        // RecipeService gained this dependency; disabled here so tests exercise
        // persistence only and never reach out to an image backend.
        {
          provide: ImageGenerationService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            generateHeroImage: jest.fn(),
            generateStepImages: jest.fn().mockResolvedValue([]),
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
  });

  describe('findAll', () => {
    it('should return all recipes from repository', async () => {
      const recipes = [
        mockRecipe,
        { ...mockRecipe, id: 'recipe-uuid-2', name: 'Omelette' },
      ];
      repository.findAll.mockResolvedValue({ data: recipes, total: 2, limit: 100, offset: 0 });

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result.data).toEqual(recipes);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty array when no recipes exist', async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return recipe when found', async () => {
      repository.findById.mockResolvedValue(mockRecipe);

      const result = await service.findById('recipe-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('recipe-uuid-1', 'en');
      expect(result).toEqual(mockRecipe);
    });

    it('should throw NotFoundException when recipe not found', async () => {
      repository.findById.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
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

      expect(repository.update).toHaveBeenCalledWith('recipe-uuid-1', {
        name: 'Blueberry Pancakes',
        ingredients: updatedRecipe.ingredients,
      }, {
        locale: 'en',
        translations: undefined,
      });
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
});
