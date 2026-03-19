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
    const mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
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

  describe('getOrCreateByWeek', () => {
    it('should return existing plan if found', async () => {
      repository.findAll.mockResolvedValue([mockPlan]);
      const result = await service.getOrCreateByWeek('2026-03-16');
      expect(result).toEqual(mockPlan);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should create new plan if not found', async () => {
      repository.findAll.mockResolvedValue([]);
      repository.create.mockResolvedValue({ ...mockPlan, entries: [] });
      const result = await service.getOrCreateByWeek('2026-03-16');
      expect(repository.create).toHaveBeenCalledWith({
        weekStartDate: '2026-03-16',
        entries: [],
      });
      expect(result.entries).toEqual([]);
    });
  });

  describe('addEntry', () => {
    it('should add an entry to the plan', async () => {
      repository.findById.mockResolvedValue({ ...mockPlan, entries: [] });
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
      repository.update.mockResolvedValue(updated);

      const result = await service.addEntry('plan-1', {
        day: DayOfWeek.TUESDAY,
        meal: MealType.LUNCH,
        recipeId: 'r2',
        servings: 2,
      });

      expect(repository.update).toHaveBeenCalled();
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('removeEntry', () => {
    it('should remove entry at index', async () => {
      repository.findById.mockResolvedValue({
        ...mockPlan,
        entries: [...mockPlan.entries],
      });
      repository.update.mockResolvedValue({ ...mockPlan, entries: [] });

      const result = await service.removeEntry('plan-1', 0);
      expect(result.entries).toHaveLength(0);
    });

    it('should throw on invalid index', async () => {
      repository.findById.mockResolvedValue({
        ...mockPlan,
        entries: [...mockPlan.entries],
      });
      await expect(service.removeEntry('plan-1', 5)).rejects.toThrow(
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

      await service.updateEntryServings('plan-1', 0, 8);
      expect(repository.update).toHaveBeenCalled();
    });
  });
});
