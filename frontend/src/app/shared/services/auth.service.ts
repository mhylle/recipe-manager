import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface AuthUser {
  email: string;
  [key: string]: unknown;
}

/**
 * Who is signed in, according to the shared mhylle SSO session.
 *
 * This decides what to *show*, never what is *allowed*. The backend guards every
 * write route itself, so if this signal is wrong — or someone flips it from a
 * console — the API still says no.
 *
 * It replaces a version that compared the email against a hardcoded ADMIN_EMAIL
 * constant. That was misleading twice over: it read like access control while
 * only hiding buttons, and it baked one person's address into a bundle anyone
 * can read.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(null);
  readonly isAuthenticated = signal(false);

  private checked = false;

  checkAuth(): void {
    if (this.checked) return;
    this.checked = true;
    // Same-origin in production, so the httpOnly auth_token cookie rides along.
    // withCredentials is set anyway so the dev proxy behaves the same way.
    this.http.get<AuthUser>('/api/auth/validate', { withCredentials: true }).subscribe({
      next: (user) => {
        this.user.set(user);
        this.isAuthenticated.set(true);
      },
      error: () => {
        this.user.set(null);
        this.isAuthenticated.set(false);
      },
    });
  }
}
