/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { BilkaToGoCartService } from './bilkatogo-cart.service';
import type { AxiosResponse } from 'axios';

function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };
}

describe('BilkaToGoCartService', () => {
  let service: BilkaToGoCartService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BilkaToGoCartService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<BilkaToGoCartService>(BilkaToGoCartService);
    httpService = module.get(HttpService);
  });

  describe('addItem', () => {
    it('should call the BilkaToGo cart API with correct parameters', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ success: true })));

      await service.addItem('auth=abc123; session=xyz789', 'prod-001', 2);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('ChangeLineCount'),
        expect.objectContaining({
          headers: { Cookie: 'auth=abc123; session=xyz789' },
        }),
      );
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('productId=prod-001'),
        expect.anything(),
      );
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('count=2'),
        expect.anything(),
      );
    });

    it('should include fullCart=0 in the request', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ success: true })));

      await service.addItem('auth=abc123', 'prod-001', 1);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('fullCart=0'),
        expect.anything(),
      );
    });
  });
});
