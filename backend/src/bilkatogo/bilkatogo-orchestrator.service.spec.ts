/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { BilkaToGoOrchestratorService } from './bilkatogo-orchestrator.service';
import { BilkaToGoAuthService } from './bilkatogo-auth.service';
import { BilkaToGoSearchService } from './bilkatogo-search.service';
import { BilkaToGoCartService } from './bilkatogo-cart.service';
import { ShoppingListService } from '../shopping-list/shopping-list.service';
import type { BilkaToGoProduct } from './interfaces/bilkatogo.interfaces';
import { Unit } from '../shared/enums/unit.enum';

const mockProduct: BilkaToGoProduct = {
  objectID: 'prod-001',
  name: 'Minimælk',
  productName: 'Minimælk 1L',
  brand: 'Arla',
  price: 1295,
  units: 1,
  netcontent: '1L',
  isInStock: 1,
};

describe('BilkaToGoOrchestratorService', () => {
  let service: BilkaToGoOrchestratorService;
  let authService: jest.Mocked<BilkaToGoAuthService>;
  let searchService: jest.Mocked<BilkaToGoSearchService>;
  let cartService: jest.Mocked<BilkaToGoCartService>;
  let shoppingListService: jest.Mocked<ShoppingListService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BilkaToGoOrchestratorService,
        {
          provide: BilkaToGoAuthService,
          useValue: { getSessionCookies: jest.fn() },
        },
        {
          provide: BilkaToGoSearchService,
          useValue: { searchProduct: jest.fn() },
        },
        {
          provide: BilkaToGoCartService,
          useValue: { addItem: jest.fn() },
        },
        {
          provide: ShoppingListService,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BilkaToGoOrchestratorService>(
      BilkaToGoOrchestratorService,
    );
    authService = module.get(BilkaToGoAuthService);
    searchService = module.get(BilkaToGoSearchService);
    cartService = module.get(BilkaToGoCartService);
    shoppingListService = module.get(ShoppingListService);
  });

  describe('sendToCart', () => {
    const mockShoppingList = {
      id: 'list-001',
      mealPlanId: 'plan-001',
      generatedDate: '2026-03-20T10:00:00.000Z',
      items: [
        { name: 'Mælk', quantity: 1, unit: Unit.L, checked: false },
        { name: 'Brød', quantity: 2, unit: Unit.PIECE, checked: false },
        { name: 'Smør', quantity: 200, unit: Unit.G, checked: true },
      ],
    };

    it('should match items, add to cart, and return results', async () => {
      authService.getSessionCookies.mockReturnValue('auth=abc123');
      shoppingListService.findById.mockResolvedValue(mockShoppingList);
      searchService.searchProduct.mockResolvedValue([mockProduct]);
      cartService.addItem.mockResolvedValue(undefined);

      const result = await service.sendToCart('list-001', 'session-001');

      expect(result.matched).toHaveLength(2);
      expect(result.unmatched).toHaveLength(0);
      expect(result.cartUrl).toBe('https://www.bilkatogo.dk/checkout/cart');

      // Should skip checked items (Smør)
      expect(searchService.searchProduct).toHaveBeenCalledTimes(2);
      expect(searchService.searchProduct).toHaveBeenCalledWith('Mælk');
      expect(searchService.searchProduct).toHaveBeenCalledWith('Brød');

      expect(cartService.addItem).toHaveBeenCalledTimes(2);
    });

    it('should add unmatched items when search returns no results', async () => {
      authService.getSessionCookies.mockReturnValue('auth=abc123');
      shoppingListService.findById.mockResolvedValue(mockShoppingList);
      searchService.searchProduct
        .mockResolvedValueOnce([mockProduct])
        .mockResolvedValueOnce([]);
      cartService.addItem.mockResolvedValue(undefined);

      const result = await service.sendToCart('list-001', 'session-001');

      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0].itemName).toBe('Brød');
      expect(result.unmatched[0].reason).toBe('No matching products found');
    });

    it('should throw UnauthorizedException when session is expired', async () => {
      authService.getSessionCookies.mockReturnValue(null);

      await expect(
        service.sendToCart('list-001', 'expired-session'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle errors for individual items gracefully', async () => {
      authService.getSessionCookies.mockReturnValue('auth=abc123');
      shoppingListService.findById.mockResolvedValue(mockShoppingList);
      searchService.searchProduct
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([mockProduct]);
      cartService.addItem.mockResolvedValue(undefined);

      const result = await service.sendToCart('list-001', 'session-001');

      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0].itemName).toBe('Mælk');
      expect(result.unmatched[0].reason).toContain('Network error');
    });

    it('should skip checked items', async () => {
      const allCheckedList = {
        ...mockShoppingList,
        items: mockShoppingList.items.map((item) => ({
          ...item,
          checked: true,
        })),
      };

      authService.getSessionCookies.mockReturnValue('auth=abc123');
      shoppingListService.findById.mockResolvedValue(allCheckedList);

      const result = await service.sendToCart('list-001', 'session-001');

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
      expect(searchService.searchProduct).not.toHaveBeenCalled();
      expect(cartService.addItem).not.toHaveBeenCalled();
    });
  });
});
