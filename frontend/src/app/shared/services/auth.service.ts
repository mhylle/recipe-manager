import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface AuthUser {
  email: string;
  [key: string]: unknown;
}

const ADMIN_EMAIL = 'mhylle@yahoo.com';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly isAdmin = signal(false);
  private checked = false;

  checkAuth(): void {
    if (this.checked) return;
    this.checked = true;
    this.http.get<AuthUser>('/api/auth/validate', { withCredentials: true }).subscribe({
      next: (user) => {
        this.isAdmin.set(user.email === ADMIN_EMAIL);
      },
      error: () => {
        this.isAdmin.set(false);
      },
    });
  }
}
