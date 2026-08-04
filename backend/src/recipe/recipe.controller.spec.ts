/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { Recipe } from '../shared/interfaces/recipe.interface';
import { Unit } from '../shared/enums/unit.enum';
import { Difficulty } from '../shared/enums/difficulty.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard';

/** New recipes are attributed to whoever added them. */
const martinUser = {
  id: 'u-martin', ssoSubject: 's-martin', email: 'mhylle@yahoo.com', displayName: 'Martin Hylleberg',
};

describe('RecipeController', () => {
  let controller: RecipeController;
  let service: jest.Mocked<RecipeService>;

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
    ],
    prepTime: 10,
    cookTime: 15,
    difficulty: Difficulty.EASY,
    tags: ['breakfast', 'quick'],
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipeController],
      providers: [{ provide: RecipeService, useValue: mockService }],
    })// The controller is the unit here. Whether the guard admits a caller is
      // SsoAuthGuard's own concern and is covered in its spec; wiring the real
      // one in would drag the user directory and Prisma into a controller test.
      .overrideGuard(SsoAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecipeController>(RecipeController);
    service = module.get(RecipeService);
  });

  describe('POST /api/recipes', () => {
    it('should create and return a recipe', async () => {
      service.create.mockResolvedValue(mockRecipe);

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
        ],
        prepTime: 10,
        cookTime: 15,
        difficulty: Difficulty.EASY,
        tags: ['breakfast', 'quick'],
      };

      const result = await controller.create(martinUser, dto, 'en');

      expect(service.create).toHaveBeenCalledWith('u-martin', dto, 'en', undefined);
      expect(result).toEqual(mockRecipe);
    });
  });

  describe('GET /api/recipes', () => {
    it('should return an array of recipes', async () => {
      const recipes = [mockRecipe];
      service.findAll.mockResolvedValue({ data: recipes, total: 1, limit: 100, offset: 0 });

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result.data).toEqual(recipes);
      expect(result.meta).toEqual({ total: 1, limit: 100, offset: 0, hasMore: false });
    });

    it('should return empty array when no recipes exist', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });

      const result = await controller.findAll();

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('GET /api/recipes/:id', () => {
    it('should return a single recipe', async () => {
      service.findById.mockResolvedValue(mockRecipe);

      const result = await controller.findById('recipe-uuid-1', 'en');

      expect(service.findById).toHaveBeenCalledWith('recipe-uuid-1', 'en');
      expect(result).toEqual(mockRecipe);
    });

    it('should throw NotFoundException for missing recipe', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(controller.findById('missing-id', 'en')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /api/recipes/:id', () => {
    it('should update and return the recipe', async () => {
      const updatedRecipe = { ...mockRecipe, name: 'Blueberry Pancakes' };
      service.update.mockResolvedValue(updatedRecipe);

      const result = await controller.update(martinUser, 'recipe-uuid-1', {
        name: 'Blueberry Pancakes',
      }, 'en');

      expect(service.update).toHaveBeenCalledWith(
        'recipe-uuid-1',
        'u-martin', // the caller — ownership is checked against this
        { name: 'Blueberry Pancakes' },
        'en',
        undefined, // translations
        undefined, // sourceLocale
      );
      expect(result.name).toBe('Blueberry Pancakes');
    });
  });

  describe('DELETE /api/recipes/:id', () => {
    it('should delete the recipe', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(martinUser, 'recipe-uuid-1');

      expect(service.delete).toHaveBeenCalledWith('recipe-uuid-1', 'u-martin');
    });

    it('should throw NotFoundException for missing recipe', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('recipes with id missing-id not found'),
      );

      await expect(controller.delete(martinUser, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
