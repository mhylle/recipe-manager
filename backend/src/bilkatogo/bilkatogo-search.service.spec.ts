/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { BilkaToGoSearchService } from './bilkatogo-search.service';
import type { AxiosResponse } from 'axios';
import type { BilkaToGoProduct } from './interfaces/bilkatogo.interfaces';

function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };
}

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

const outOfStockProduct: BilkaToGoProduct = {
  objectID: 'prod-002',
  name: 'Sødmælk',
  productName: 'Sødmælk 1L',
  brand: 'Arla',
  price: 1395,
  units: 1,
  netcontent: '1L',
  isInStock: 0,
};

describe('BilkaToGoSearchService', () => {
  let service: BilkaToGoSearchService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BilkaToGoSearchService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<BilkaToGoSearchService>(BilkaToGoSearchService);
    httpService = module.get(HttpService);
  });

  describe('searchProduct', () => {
    it('should return in-stock products matching the query', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            results: [{ hits: [mockProduct, outOfStockProduct] }],
          }),
        ),
      );

      const results = await service.searchProduct('mælk');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockProduct);
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('algolia.net'),
        expect.objectContaining({
          requests: [
            expect.objectContaining({
              indexName: 'prod_BILKATOGO_PRODUCTS',
            }),
          ],
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-algolia-application-id': 'F9VBJLR1BK',
            'x-algolia-api-key': '1deaf41c87e729779f7695c00f190cc9',
          }),
        }),
      );
    });

    it('should return empty array when no results', async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ results: [{ hits: [] }] })),
      );

      const results = await service.searchProduct('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should return empty array when all products are out of stock', async () => {
      httpService.post.mockReturnValue(
        of(
          mockAxiosResponse({
            results: [{ hits: [outOfStockProduct] }],
          }),
        ),
      );

      const results = await service.searchProduct('sødmælk');

      expect(results).toHaveLength(0);
    });

    it('should handle missing results gracefully', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ results: [] })));

      const results = await service.searchProduct('test');

      expect(results).toHaveLength(0);
    });
  });
});
