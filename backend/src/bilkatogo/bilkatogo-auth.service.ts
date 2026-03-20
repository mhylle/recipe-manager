/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import type { BilkaToGoSession } from './interfaces/bilkatogo.interfaces.js';

const GIGYA_API_KEY =
  '3_tA6BbV434FQqN73HnUG1KA3qFv8KiG4OqLu9eWPh7sKRqRizH5Vfv5Larmgrb4I2';
const GIGYA_LOGIN_URL = 'https://accounts.eu1.gigya.com/accounts.login';
const GIGYA_JWT_URL = 'https://accounts.eu1.gigya.com/accounts.getJWT';
const BILKATOGO_LOGIN_JWT_URL = 'https://api.bilkatogo.dk/api/auth/LoginJWT';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class BilkaToGoAuthService {
  private readonly logger = new Logger(BilkaToGoAuthService.name);
  private readonly sessions = new Map<string, BilkaToGoSession>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private readonly httpService: HttpService) {
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredSessions(),
      CLEANUP_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  async login(email: string, password: string): Promise<string> {
    const loginToken = await this.gigyaLogin(email, password);
    const idToken = await this.gigyaGetJWT(loginToken);
    const cookies = await this.bilkaToGoLoginJWT(idToken);

    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      cookies,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    this.logger.log(`Session created: ${sessionId}`);
    return sessionId;
  }

  getSessionCookies(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session.cookies;
  }

  private async gigyaLogin(email: string, password: string): Promise<string> {
    const body = new URLSearchParams({
      apiKey: GIGYA_API_KEY,
      loginID: email,
      password,
    }).toString();

    const response = await firstValueFrom(
      this.httpService.post(GIGYA_LOGIN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    if (response.data.errorCode !== 0) {
      this.logger.warn(
        `Gigya login failed: ${response.data.errorMessage ?? 'Unknown error'}`,
      );
      throw new UnauthorizedException(
        response.data.errorMessage ?? 'Gigya login failed',
      );
    }

    const loginToken = response.data.sessionInfo?.cookieValue;
    if (!loginToken) {
      throw new UnauthorizedException('No login token returned from Gigya');
    }

    return loginToken;
  }

  private async gigyaGetJWT(loginToken: string): Promise<string> {
    const body = new URLSearchParams({
      apiKey: GIGYA_API_KEY,
      login_token: loginToken,
      expiration: '86400',
    }).toString();

    const response = await firstValueFrom(
      this.httpService.post(GIGYA_JWT_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    if (response.data.errorCode !== 0) {
      this.logger.warn(
        `Gigya JWT failed: ${response.data.errorMessage ?? 'Unknown error'}`,
      );
      throw new UnauthorizedException(
        response.data.errorMessage ?? 'Failed to get JWT from Gigya',
      );
    }

    const idToken = response.data.id_token;
    if (!idToken) {
      throw new UnauthorizedException('No id_token returned from Gigya');
    }

    return idToken;
  }

  private async bilkaToGoLoginJWT(idToken: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        BILKATOGO_LOGIN_JWT_URL,
        { jwt: idToken },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
          maxRedirects: 0,
        },
      ),
    );

    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders || !Array.isArray(setCookieHeaders)) {
      throw new UnauthorizedException(
        'No cookies returned from BilkaToGo login',
      );
    }

    return setCookieHeaders.join('; ');
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} expired session(s)`);
    }
  }
}
