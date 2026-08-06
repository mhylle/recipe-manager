import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

interface AuthUser {
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/**
 * The auth-service answers in an envelope: `{ success, data: { id, email, ... } }`.
 * Reading `email` off the top level — which this service used to do — silently
 * yields undefined.
 */
interface AuthEnvelope {
  success: boolean;
  data: AuthUser;
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

  /** Display name for the header, falling back to the address. */
  readonly displayName = signal<string | null>(null);

  /**
   * Our own User.id for the signed-in caller.
   *
   * NOT the same as the id `/api/auth/validate` returns — that one is the
   * auth-service's. Recipes carry `createdBy.id`, which is ours, so comparing
   * against the wrong id would silently never match and every edit button would
   * vanish for everyone.
   */
  readonly localUserId = signal<string | null>(null);

  /**
   * Whether this account may add to or change the SHARED recipe library.
   *
   * Comes from the backend's reading of the token's `apps` grant, never decided
   * here — the client cannot be the authority on its own permissions. Used only
   * to avoid offering buttons the API would refuse: a self-registered cook gets
   * their own kitchen and the whole library to read, and hiding the "add recipe"
   * they cannot use is the difference between read-only and broken.
   *
   * Fails closed. An unreachable /api/me leaves this false.
   */
  readonly canContribute = signal(false);

  private checked = false;

  checkAuth(): void {
    if (this.checked) return;
    this.checked = true;
    this.refresh().subscribe();
  }

  /**
   * Re-read the session. Unlike checkAuth this always calls — it is what runs
   * after a successful sign-in, when the cached "not signed in" answer is stale.
   */
  refresh(): Observable<boolean> {
    // Same-origin in production, so the httpOnly auth_token cookie rides along.
    // withCredentials is set anyway so the dev proxy behaves the same way.
    return this.http
      .get<AuthEnvelope>('/api/auth/validate', { withCredentials: true })
      .pipe(
        tap((res) => this.adopt(res?.data ?? null)),
        switchMap(() => this.loadLocalIdentity()),
        map(() => true),
        catchError(() => {
          this.adopt(null);
          return of(false);
        }),
      );
  }

  /**
   * Fetch the LOCAL user row. Failure is not fatal: the session is still valid,
   * we just cannot offer ownership-gated actions, which fails closed.
   */
  private loadLocalIdentity(): Observable<unknown> {
    return this.http
      .get<{ id: string; canContribute?: boolean }>(`${environment.apiBase}/api/me`, {
        withCredentials: true,
      })
      .pipe(
        tap((me) => {
          this.localUserId.set(me?.id ?? null);
          this.canContribute.set(me?.canContribute === true);
        }),
        catchError(() => {
          this.localUserId.set(null);
          this.canContribute.set(false);
          return of(null);
        }),
      );
  }

  /**
   * Sign in against the central auth-service.
   *
   * Credentials go straight to mhylle.com's own endpoint, which sets the shared
   * `auth_token` cookie for the whole estate — this app never sees a password
   * beyond forwarding it, and never stores one. Same-origin, so no redirect.
   */
  login(email: string, password: string): Observable<boolean> {
    return this.http
      .post<AuthEnvelope>(
        '/api/auth/login',
        { email, password },
        { withCredentials: true },
      )
      .pipe(
        tap((res) => this.adopt(res?.success ? res.data : null)),
        switchMap((res) =>
          res?.success ? this.loadLocalIdentity().pipe(map(() => res)) : of(res),
        ),
        map((res) => !!res?.success),
      );
  }

  /**
   * Create an account on the central auth-service, then sign it in.
   *
   * Two calls on purpose. `POST /api/auth/register` answers 201 with
   * `{"success":true,"message":"Registration request received"}` and sets NO
   * cookie, so a registrant who was not then logged in would land back on the
   * sign-in dialog wondering whether it worked. Chaining login uses credentials
   * we already hold, at the only moment we hold them.
   *
   * A new account is granted the estate's default apps, which do not include
   * this one — so the cook can immediately browse and run their own kitchen, and
   * contributing to the shared library waits on a grant. That is the intended
   * shape, not a failure, so this resolves successfully either way.
   */
  register(input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Observable<boolean> {
    return this.http
      .post<{ success?: boolean }>(
        '/api/auth/register',
        {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          password: input.password,
          confirmPassword: input.password,
        },
        { withCredentials: true },
      )
      .pipe(
        switchMap((res) =>
          res?.success === false
            ? of(false)
            : this.login(input.email, input.password),
        ),
      );
  }

  logout(): Observable<boolean> {
    return this.http
      .post('/api/auth/logout', {}, { withCredentials: true })
      .pipe(
        tap(() => this.adopt(null)),
        map(() => true),
        catchError(() => {
          // The cookie may already be gone. Treat it as signed out either way —
          // leaving the UI claiming a session that no longer works is worse.
          this.adopt(null);
          return of(true);
        }),
      );
  }

  private adopt(user: AuthUser | null): void {
    this.user.set(user);
    this.isAuthenticated.set(!!user);
    if (!user) {
      this.displayName.set(null);
      this.localUserId.set(null);
      // Signing out must revoke the offer too. Leaving it true would show an
      // "add recipe" button to a guest, who would then hit a 401.
      this.canContribute.set(false);
      return;
    }
    const composed = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    this.displayName.set(composed || user.email);
  }
}
