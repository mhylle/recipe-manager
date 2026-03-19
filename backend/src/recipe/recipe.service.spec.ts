/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { RecipeRepository } from './recipe.repository';
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
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: RecipeRepository, useValue: mockRepository },
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

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
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
      repository.findAll.mockResolvedValue(recipes);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(recipes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no recipes exist', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return recipe when found', async () => {
      repository.findById.mockResolvedValue(mockRecipe);

      const result = await service.findById('recipe-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('recipe-uuid-1');
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

      const result = await service.update('recipe-uuid-1', {
        name: 'Blueberry Pancakes',
        ingredients: updatedRecipe.ingredients,
      });

      expect(repository.update).toHaveBeenCalledWith('recipe-uuid-1', {
        name: 'Blueberry Pancakes',
        ingredients: updatedRecipe.ingredients,
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

      const result = await service.update('recipe-uuid-1', {
        ingredients: [mockRecipe.ingredients[0]],
      });

      expect(result.ingredients).toHaveLength(1);
    });

    it('should throw NotFoundException when updating non-existent recipe', async () => {
      repository.update.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(
        service.update('missing-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delegate to repository', async () => {
      repository.delete.mockResolvedValue(undefined);

      await service.delete('recipe-uuid-1');

      expect(repository.delete).toHaveBeenCalledWith('recipe-uuid-1');
    });

    it('should throw NotFoundException when deleting non-existent recipe', async () => {
      repository.delete.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
