import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PantryService } from '../pantry/pantry.service';
import { RecipeService } from '../recipe/recipe.service';
import { StaplesService } from '../staples/staples.service';
import { Recipe } from '../shared/interfaces/recipe.interface';
import { PantryItem } from '../shared/interfaces/pantry-item.interface';
import { Unit } from '../shared/enums/unit.enum';
import { Difficulty } from '../shared/enums/difficulty.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';

describe('MatchingService', () => {
  let service: MatchingService;
  let pantryService: jest.Mocked<PantryService>;
  let recipeService: jest.Mocked<RecipeService>;
  let staplesService: jest.Mocked<StaplesService>;

  const makePantryItem = (
    name: string,
    quantity: number,
    unit: Unit,
    category: PantryCategory,
  ): PantryItem => ({
    id: `pantry-${name}`,
    name,
    quantity,
    unit,
    category,
    addedDate: '2026-03-19T10:00:00.000Z',
    lastUpdated: '2026-03-19T10:00:00.000Z',
  });

  const makeRecipe = (
    name: string,
    ingredients: Recipe['ingredients'],
    servings = 4,
  ): Recipe => ({
    id: `recipe-${name}`,
    name,
    description: `${name} description`,
    servings,
    instructions: ['Step 1'],
    ingredients,
    prepTime: 10,
    cookTime: 20,
    difficulty: Difficulty.EASY,
    tags: [],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: PantryService,
          useValue: { findAll: jest.fn() },
        },
        {
          provide: RecipeService,
          useValue: { findAll: jest.fn() },
        },
        {
          provide: StaplesService,
          useValue: { getStaples: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    pantryService = module.get(PantryService);
    recipeService = module.get(RecipeService);
    staplesService = module.get(StaplesService);

    staplesService.getStaples.mockResolvedValue({ items: [] });
  });

  it('should classify recipe with all ingredients in pantry as "can make now"', async () => {
    const pantry = [
      makePantryItem('Flour', 500, Unit.G, PantryCategory.BAKING),
      makePantryItem('Milk', 1000, Unit.ML, PantryCategory.DAIRY),
    ];
    const recipe = makeRecipe('Pancakes', [
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
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.canMakeNow).toHaveLength(1);
    expect(result.canMakeNow[0].name).toBe('Pancakes');
    expect(result.almostCanMake).toHaveLength(0);
    expect(result.missingMany).toHaveLength(0);
  });

  it('should classify recipe with insufficient quantity as "need 1-2"', async () => {
    const pantry = [
      makePantryItem('Flour', 100, Unit.G, PantryCategory.BAKING),
      makePantryItem('Milk', 1000, Unit.ML, PantryCategory.DAIRY),
    ];
    const recipe = makeRecipe('Pancakes', [
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
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.canMakeNow).toHaveLength(0);
    expect(result.almostCanMake).toHaveLength(1);
    expect(result.almostCanMake[0].recipe.name).toBe('Pancakes');
    expect(result.almostCanMake[0].missingIngredients).toHaveLength(1);
    expect(result.almostCanMake[0].missingIngredients[0].name).toBe('Flour');
  });

  it('should classify recipe with 1 missing ingredient as "need 1-2"', async () => {
    const pantry = [
      makePantryItem('Flour', 500, Unit.G, PantryCategory.BAKING),
    ];
    const recipe = makeRecipe('Pancakes', [
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
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.almostCanMake).toHaveLength(1);
    expect(result.almostCanMake[0].missingIngredients).toHaveLength(1);
    expect(result.almostCanMake[0].missingIngredients[0].name).toBe('Milk');
  });

  it('should classify recipe with 2 missing ingredients as "need 1-2"', async () => {
    const pantry: PantryItem[] = [];
    const recipe = makeRecipe('Simple', [
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
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.almostCanMake).toHaveLength(1);
    expect(result.almostCanMake[0].missingIngredients).toHaveLength(2);
  });

  it('should classify recipe with 3+ missing ingredients as "missing many"', async () => {
    const pantry: PantryItem[] = [];
    const recipe = makeRecipe('Complex', [
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
      {
        name: 'Butter',
        quantity: 50,
        unit: Unit.G,
        pantryCategory: PantryCategory.DAIRY,
      },
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.canMakeNow).toHaveLength(0);
    expect(result.almostCanMake).toHaveLength(0);
    expect(result.missingMany).toHaveLength(1);
    expect(result.missingMany[0].name).toBe('Complex');
  });

  it('should exclude staple ingredients from missing count', async () => {
    const pantry = [
      makePantryItem('Flour', 500, Unit.G, PantryCategory.BAKING),
    ];
    const recipe = makeRecipe('Seasoned Flour', [
      {
        name: 'Flour',
        quantity: 200,
        unit: Unit.G,
        pantryCategory: PantryCategory.BAKING,
      },
      {
        name: 'Salt',
        quantity: 5,
        unit: Unit.G,
        pantryCategory: PantryCategory.SPICES,
      },
      {
        name: 'Pepper',
        quantity: 2,
        unit: Unit.G,
        pantryCategory: PantryCategory.SPICES,
      },
      {
        name: 'Oil',
        quantity: 30,
        unit: Unit.ML,
        pantryCategory: PantryCategory.CONDIMENTS,
      },
    ]);

    staplesService.getStaples.mockResolvedValue({
      items: ['Salt', 'Pepper', 'Oil'],
    });
    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    // Salt, Pepper, Oil are staples so only Flour counts, and we have it
    expect(result.canMakeNow).toHaveLength(1);
    expect(result.canMakeNow[0].name).toBe('Seasoned Flour');
  });

  it('should scale quantities when servings override is provided', async () => {
    const pantry = [
      makePantryItem('Flour', 300, Unit.G, PantryCategory.BAKING),
    ];
    // Recipe serves 4, needs 200g flour
    const recipe = makeRecipe(
      'Pancakes',
      [
        {
          name: 'Flour',
          quantity: 200,
          unit: Unit.G,
          pantryCategory: PantryCategory.BAKING,
        },
      ],
      4,
    );

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    // Request 8 servings = 400g flour needed, only have 300g
    const result = await service.matchRecipes(8);

    expect(result.canMakeNow).toHaveLength(0);
    expect(result.almostCanMake).toHaveLength(1);
    expect(result.almostCanMake[0].missingIngredients[0].required).toBe(400);
    expect(result.almostCanMake[0].missingIngredients[0].available).toBe(300);
  });

  it('should classify all recipes as "missing many" with empty pantry and many ingredients', async () => {
    const pantry: PantryItem[] = [];
    const recipe = makeRecipe('Complex Recipe', [
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
      {
        name: 'Sugar',
        quantity: 100,
        unit: Unit.G,
        pantryCategory: PantryCategory.BAKING,
      },
      {
        name: 'Butter',
        quantity: 50,
        unit: Unit.G,
        pantryCategory: PantryCategory.DAIRY,
      },
    ]);

    pantryService.findAll.mockResolvedValue(pantry);
    recipeService.findAll.mockResolvedValue([recipe]);

    const result = await service.matchRecipes();

    expect(result.missingMany).toHaveLength(1);
    expect(result.canMakeNow).toHaveLength(0);
    expect(result.almostCanMake).toHaveLength(0);
  });
});
