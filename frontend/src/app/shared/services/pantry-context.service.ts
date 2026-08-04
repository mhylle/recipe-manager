import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PantrySummary {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  memberCount: number;
}

/**
 * Which kitchen the app is currently looking at.
 *
 * Kitchen data is per-pantry now, and a user can belong to more than one. This
 * holds the list and the selection, and is the single place that knows whether
 * the reason a pantry page is empty is "not signed in", "no kitchen yet", or
 * "an empty kitchen" — three states that look identical if you only check for
 * an empty array.
 */
export type KitchenState = 'loading' | 'anonymous' | 'no-pantry' | 'ready';

@Injectable({ providedIn: 'root' })
export class PantryContextService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/pantry`;

  readonly pantries = signal<PantrySummary[]>([]);
  readonly currentId = signal<string | null>(null);
  readonly state = signal<KitchenState>('loading');

  /**
   * Bumped whenever WHICH kitchen we are looking at may have changed — a
   * sign-in, a sign-out, or picking a different one from the switcher.
   *
   * Kitchen-scoped pages watch this the same way they watch the language. They
   * fetch per-user data, so a page that loaded once on construction keeps
   * showing the previous person's kitchen — after signing in, the dashboard
   * carried on showing the signed-out state until a manual reload.
   */
  readonly revision = signal(0);

  readonly current = computed(() => {
    const id = this.currentId();
    return this.pantries().find((p) => p.id === id) ?? this.pantries()[0] ?? null;
  });

  /** Only worth offering a switcher when there is something to switch between. */
  readonly canSwitch = computed(() => this.pantries().length > 1);

  load(): void {
    this.state.set('loading');
    // Bump immediately: the identity may already have changed, and pages should
    // re-fetch even if the request below fails.
    this.revision.update((n) => n + 1);
    this.http.get<PantrySummary[]>(`${this.baseUrl}/mine`).subscribe({
      next: (list) => {
        this.pantries.set(list);
        if (list.length === 0) {
          this.state.set('no-pantry');
          return;
        }
        const stored = localStorage.getItem('recipe-manager.pantry');
        const chosen = list.find((p) => p.id === stored) ?? list[0];
        this.currentId.set(chosen.id);
        this.state.set('ready');
      },
      error: (err: { status?: number }) => {
        // 401 is "not signed in", which is a different message from "you have no
        // kitchen". Conflating them tells a signed-in user to sign in.
        this.state.set(err.status === 401 ? 'anonymous' : 'no-pantry');
        this.pantries.set([]);
      },
    });
  }

  select(id: string): void {
    if (id === this.currentId()) return;
    this.currentId.set(id);
    localStorage.setItem('recipe-manager.pantry', id);
    this.revision.update((n) => n + 1);
  }
}
