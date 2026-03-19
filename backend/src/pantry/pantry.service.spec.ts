/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PantryService } from './pantry.service';
import { PantryRepository } from './pantry.repository';
import { PantryItem } from '../shared/interfaces/pantry-item.interface';
import { Unit } from '../shared/enums/unit.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';

describe('PantryService', () => {
  let service: PantryService;
  let repository: jest.Mocked<PantryRepository>;

  const mockPantryItem: PantryItem = {
    id: 'test-uuid-1',
    name: 'Flour',
    quantity: 500,
    unit: Unit.G,
    category: PantryCategory.BAKING,
    addedDate: '2026-03-19T10:00:00.000Z',
    lastUpdated: '2026-03-19T10:00:00.000Z',
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
        PantryService,
        { provide: PantryRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<PantryService>(PantryService);
    repository = module.get(PantryRepository);
  });

  describe('create', () => {
    it('should delegate to repository and return created item', async () => {
      repository.create.mockResolvedValue(mockPantryItem);

      const dto = {
        name: 'Flour',
        quantity: 500,
        unit: Unit.G,
        category: PantryCategory.BAKING,
      };

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPantryItem);
      expect(result.id).toBeDefined();
      expect(result.addedDate).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all items from repository', async () => {
      const items = [
        mockPantryItem,
        { ...mockPantryItem, id: 'test-uuid-2', name: 'Sugar' },
      ];
      repository.findAll.mockResolvedValue(items);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(items);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no items exist', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return item when found', async () => {
      repository.findById.mockResolvedValue(mockPantryItem);

      const result = await service.findById('test-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('test-uuid-1');
      expect(result).toEqual(mockPantryItem);
    });

    it('should throw NotFoundException when item not found', async () => {
      repository.findById.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should delegate to repository with merged fields', async () => {
      const updatedItem = {
        ...mockPantryItem,
        quantity: 250,
        lastUpdated: '2026-03-19T12:00:00.000Z',
      };
      repository.update.mockResolvedValue(updatedItem);

      const result = await service.update('test-uuid-1', { quantity: 250 });

      expect(repository.update).toHaveBeenCalledWith('test-uuid-1', {
        quantity: 250,
      });
      expect(result.quantity).toBe(250);
      expect(result.lastUpdated).not.toBe(mockPantryItem.lastUpdated);
    });

    it('should throw NotFoundException when updating non-existent item', async () => {
      repository.update.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(
        service.update('missing-id', { quantity: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delegate to repository', async () => {
      repository.delete.mockResolvedValue(undefined);

      await service.delete('test-uuid-1');

      expect(repository.delete).toHaveBeenCalledWith('test-uuid-1');
    });

    it('should throw NotFoundException when deleting non-existent item', async () => {
      repository.delete.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
