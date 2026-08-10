/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';
import { PantryAccessService } from './pantry-access.service';
import { BarcodeLookupService } from './barcode/barcode-lookup.service';
import { PantryItem } from '../shared/interfaces/pantry-item.interface';
import { Unit } from '../shared/enums/unit.enum';
import { PantryCategory } from '../shared/enums/pantry-category.enum';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard';

/** The controller now resolves its kitchen from the caller, so tests need one. */
const martinUser = {
  id: 'u-martin',
  ssoSubject: 's-martin',
  email: 'mhylle@yahoo.com',
  displayName: 'Martin Hylleberg',
};

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
      providers: [
        { provide: PantryService, useValue: mockService },
        {
          // Membership resolution has its own spec. Here it just hands back the
          // kitchen so the controller's delegation is what is being tested.
          provide: PantryAccessService,
          useValue: {
            resolve: jest.fn().mockResolvedValue('p-test'),
            listForUser: jest.fn(),
          },
        },
        // Barcode lookup calls a third party and has its own spec. Stubbed here
        // so a controller test never reaches out over the network.
        { provide: BarcodeLookupService, useValue: { lookup: jest.fn() } },
      ],
    }) // The controller is the unit here. Whether the guard admits a caller is
      // SsoAuthGuard's own concern and is covered in its spec; wiring the real
      // one in would drag the user directory and Prisma into a controller test.
      .overrideGuard(SsoAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

      const result = await controller.create(martinUser, dto, 'en');

      expect(service.create).toHaveBeenCalledWith(
        'p-test',
        dto,
        'en',
        undefined,
      );
      expect(result).toEqual(mockPantryItem);
    });
  });

  describe('GET /api/pantry', () => {
    it('should return an array of pantry items', async () => {
      const items = [mockPantryItem];
      service.findAll.mockResolvedValue(items);

      const result = await controller.findAll(martinUser);

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it('should return empty array when no items exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(martinUser);

      expect(result).toEqual([]);
    });
  });

  describe('GET /api/pantry/:id', () => {
    it('should return a single pantry item', async () => {
      service.findById.mockResolvedValue(mockPantryItem);

      const result = await controller.findById(martinUser, 'test-uuid-1', 'en');

      expect(service.findById).toHaveBeenCalledWith(
        'p-test',
        'test-uuid-1',
        'en',
      );
      expect(result).toEqual(mockPantryItem);
    });

    it('should throw NotFoundException for missing item', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(
        controller.findById(martinUser, 'missing-id', 'en'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /api/pantry/:id', () => {
    it('should update and return the pantry item', async () => {
      const updatedItem = { ...mockPantryItem, quantity: 250 };
      service.update.mockResolvedValue(updatedItem);

      const result = await controller.update(
        martinUser,
        'test-uuid-1',
        { quantity: 250 },
        'en',
      );

      expect(service.update).toHaveBeenCalledWith(
        'p-test',
        'test-uuid-1',
        {
          quantity: 250,
        },
        'en',
        undefined,
      );
      expect(result.quantity).toBe(250);
    });
  });

  describe('DELETE /api/pantry/:id', () => {
    it('should delete the pantry item', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(martinUser, 'test-uuid-1');

      expect(service.delete).toHaveBeenCalledWith('p-test', 'test-uuid-1');
    });

    it('should throw NotFoundException for missing item', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('pantry with id missing-id not found'),
      );

      await expect(controller.delete(martinUser, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
