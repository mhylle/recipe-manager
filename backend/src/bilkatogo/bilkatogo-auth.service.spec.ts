/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { BilkaToGoAuthService } from './bilkatogo-auth.service';
import type { AxiosResponse } from 'axios';

function mockAxiosResponse<T>(
  data: T,
  headers: Record<string, unknown> = {},
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers,
    config: {} as any,
  };
}

describe('BilkaToGoAuthService', () => {
  let service: BilkaToGoAuthService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BilkaToGoAuthService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<BilkaToGoAuthService>(BilkaToGoAuthService);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('login', () => {
    const gigyaLoginResponse = mockAxiosResponse({
      errorCode: 0,
      sessionInfo: { cookieValue: 'test-login-token' },
    });

    const gigyaJwtResponse = mockAxiosResponse({
      errorCode: 0,
      id_token: 'test-jwt-token',
    });

    const bilkaToGoLoginResponse = mockAxiosResponse(
      { success: true },
      { 'set-cookie': ['auth=abc123; Path=/', 'session=xyz789; Path=/'] },
    );

    it('should complete the 3-step auth flow and return a session ID', async () => {
      httpService.post
        .mockReturnValueOnce(of(gigyaLoginResponse))
        .mockReturnValueOnce(of(gigyaJwtResponse))
        .mockReturnValueOnce(of(bilkaToGoLoginResponse));

      const sessionId = await service.login('test@example.com', 'password123');

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(httpService.post).toHaveBeenCalledTimes(3);

      // Verify Gigya login call
      expect(httpService.post).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('accounts.login'),
        expect.stringContaining('loginID=test%40example.com'),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      // Verify Gigya JWT call
      expect(httpService.post).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('accounts.getJWT'),
        expect.stringContaining('login_token=test-login-token'),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      // Verify BilkaToGo JWT login call
      expect(httpService.post).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('LoginJWT'),
        { jwt: 'test-jwt-token' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
          maxRedirects: 0,
        }),
      );
    });

    it('should throw UnauthorizedException when Gigya login fails', async () => {
      httpService.post.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            errorCode: 403042,
            errorMessage: 'Invalid credentials',
          }),
        ),
      );

      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Gigya login returns no token', async () => {
      httpService.post.mockReturnValueOnce(
        of(mockAxiosResponse({ errorCode: 0, sessionInfo: {} })),
      );

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Gigya JWT fails', async () => {
      httpService.post
        .mockReturnValueOnce(of(gigyaLoginResponse))
        .mockReturnValueOnce(
          of(
            mockAxiosResponse({
              errorCode: 500,
              errorMessage: 'JWT generation failed',
            }),
          ),
        );

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when BilkaToGo returns no cookies', async () => {
      httpService.post
        .mockReturnValueOnce(of(gigyaLoginResponse))
        .mockReturnValueOnce(of(gigyaJwtResponse))
        .mockReturnValueOnce(of(mockAxiosResponse({ success: true })));

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getSessionCookies', () => {
    it('should return cookies for a valid session', async () => {
      const gigyaLoginResponse = mockAxiosResponse({
        errorCode: 0,
        sessionInfo: { cookieValue: 'test-login-token' },
      });
      const gigyaJwtResponse = mockAxiosResponse({
        errorCode: 0,
        id_token: 'test-jwt-token',
      });
      const bilkaToGoLoginResponse = mockAxiosResponse(
        { success: true },
        { 'set-cookie': ['auth=abc123; Path=/', 'session=xyz789; Path=/'] },
      );

      httpService.post
        .mockReturnValueOnce(of(gigyaLoginResponse))
        .mockReturnValueOnce(of(gigyaJwtResponse))
        .mockReturnValueOnce(of(bilkaToGoLoginResponse));

      const sessionId = await service.login('test@example.com', 'password123');
      const cookies = service.getSessionCookies(sessionId);

      expect(cookies).toBe('auth=abc123; Path=/; session=xyz789; Path=/');
    });

    it('should return null for a non-existent session', () => {
      const cookies = service.getSessionCookies('non-existent-id');
      expect(cookies).toBeNull();
    });
  });
});
