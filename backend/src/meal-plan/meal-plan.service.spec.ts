/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanRepository } from './meal-plan.repository';
import { DayOfWeek } from '../shared/enums/day-of-week.enum';
import { MealType } from '../shared/enums/meal-type.enum';

describe('MealPlanService', () => {
  let service: MealPlanService;
  let repository: jest.Mocked<MealPlanRepository>;

  const mockPlan = {
    id: 'plan-1',
    weekStartDate: '2026-03-16',
    entries: [
      {
        day: DayOfWeek.MONDAY,
        meal: MealType.DINNER,
        recipeId: 'r1',
        servings: 4,
      },
    ],
  };

  beforeEach(async () => {
    // Must mirror every method MealPlanService actually calls — an incomplete
    // mock fails as "not a function" rather than as a useful assertion.
    const mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByWeek: jest.fn(),
      addEntry: jest.fn(),
      removeEntryByIndex: jest.fn(),
      getEntryByIndex: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlanService,
        { provide: MealPlanRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<MealPlanService>(MealPlanService);
    repository = module.get(MealPlanRepository);
  });

  // These specs were written against an older service that filtered findAll() and
  // did its own index arithmetic. It now delegates to the repository's findByWeek
  // and removeEntryByIndex, so the mocks target those instead. Same behaviours.

  describe('getOrCreateByWeek', () => {
    it('should return existing plan if found', async () => {
      repository.findByWeek.mockResolvedValue(mockPlan);
      const result = await service.getOrCreateByWeek('p-test', '2026-03-16');
      expect(result).toEqual(mockPlan);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should create new plan if not found', async () => {
      repository.findByWeek.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockPlan, entries: [] });
      const result = await service.getOrCreateByWeek('p-test', '2026-03-16');
      expect(repository.create).toHaveBeenCalledWith('p-test', {
        weekStartDate: '2026-03-16',
        entries: [],
      });
      expect(result.entries).toEqual([]);
    });
  });

  describe('addEntry', () => {
    it('should add an entry to the plan', async () => {
      const updated = {
        ...mockPlan,
        entries: [
          {
            day: DayOfWeek.TUESDAY,
            meal: MealType.LUNCH,
            recipeId: 'r2',
            servings: 2,
          },
        ],
      };
      repository.addEntry.mockResolvedValue(updated);

      const result = await service.addEntry('p-test', 'plan-1', {
        day: DayOfWeek.TUESDAY,
        meal: MealType.LUNCH,
        recipeId: 'r2',
        servings: 2,
      });

      expect(repository.addEntry).toHaveBeenCalledWith('p-test', 'plan-1', {
        day: DayOfWeek.TUESDAY,
        meal: MealType.LUNCH,
        recipeId: 'r2',
        servings: 2,
      });
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('removeEntry', () => {
    it('should remove entry at index', async () => {
      repository.removeEntryByIndex.mockResolvedValue({
        ...mockPlan,
        entries: [],
      });

      const result = await service.removeEntry('p-test', 'plan-1', 0);

      expect(repository.removeEntryByIndex).toHaveBeenCalledWith(
        'p-test',
        'plan-1',
        0,
      );
      expect(result.entries).toHaveLength(0);
    });

    it('should throw on invalid index', async () => {
      // Index validation now lives in the repository, so the rejection propagates.
      repository.removeEntryByIndex.mockRejectedValue(
        new NotFoundException('Entry at index 5 not found'),
      );
      await expect(service.removeEntry('p-test', 'plan-1', 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateEntryServings', () => {
    it('should update servings for entry', async () => {
      repository.findById.mockResolvedValue({
        ...mockPlan,
        entries: [...mockPlan.entries],
      });
      repository.update.mockResolvedValue({
        ...mockPlan,
        entries: [{ ...mockPlan.entries[0], servings: 8 }],
      });

      await service.updateEntryServings('p-test', 'plan-1', 0, 8);
      expect(repository.update).toHaveBeenCalled();
    });
  });
});
