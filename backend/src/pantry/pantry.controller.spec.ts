/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';
import { PantryItem } from '../shared/interfaces/pantry-item.interface';
import { Unit } from '../shared/enums/unit.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';

describe('PantryController', () => {
  let controller: PantryController;
  let service: jest.Mocked<PantryService>;

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
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PantryController],
      providers: [{ provide: PantryService, useValue: mockService }],
    }).compile();

    controller = module.get<PantryController>(PantryController);
    service = module.get(PantryService);
  });

  describe('POST /api/pantry', () => {
    it('should create and return a pantry item', async () => {
      service.create.mockResolvedValue(mockPantryItem);

      const dto = {
        name: 'Flour',
        quantity: 500,
        unit: Unit.G,
        category: PantryCategory.BAKING,
      };

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPantryItem);
    });
  });

  describe('GET /api/pantry', () => {
    it('should return an array of pantry items', async () => {
      const items = [mockPantryItem];
      service.findAll.mockResolvedValue(items);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it('should return empty array when no items exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('GET /api/pantry/:id', () => {
    it('should return a single pantry item', async () => {
      service.findById.mockResolvedValue(mockPantryItem);

      const result = await controller.findById('test-uuid-1');

      expect(service.findById).toHaveBeenCalledWith('test-uuid-1');
      expect(result).toEqual(mockPantryItem);
    });

    it('should throw NotFoundException for missing item', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(controller.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /api/pantry/:id', () => {
    it('should update and return the pantry item', async () => {
      const updatedItem = { ...mockPantryItem, quantity: 250 };
      service.update.mockResolvedValue(updatedItem);

      const result = await controller.update('test-uuid-1', { quantity: 250 });

      expect(service.update).toHaveBeenCalledWith('test-uuid-1', {
        quantity: 250,
      });
      expect(result.quantity).toBe(250);
    });
  });

  describe('DELETE /api/pantry/:id', () => {
    it('should delete the pantry item', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('test-uuid-1');

      expect(service.delete).toHaveBeenCalledWith('test-uuid-1');
    });

    it('should throw NotFoundException for missing item', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(controller.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
