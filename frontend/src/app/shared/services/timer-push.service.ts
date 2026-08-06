import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** A timer the backend has promised to ring. */
export interface ServerTimer {
  id: string;
  title: string;
  body: string;
  /** ISO instant. */
  fireAt: string;
}

/**
 * Why the phone-ringing offer is or is not available.
 *
 *  - `unsupported` — this browser cannot receive push at all. On iPhone that is
 *    every Safari tab: Apple exposes PushManager only to a Home Screen web app,
 *    so the honest answer is "install it first", not "your browser is old".
 *  - `unconfigured` — the backend has no VAPID keys, so nothing could be sent.
 *  - `denied` — the user said no. Asking again does nothing; the browser
 *    remembers until they clear it in site settings.
 *  - `off` — available and not yet enabled.
 *  - `on` — subscribed; timers will ring on the lock screen.
 */
export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

@Injectable({ providedIn: 'root' })
export class TimerPushService {
  private readonly http = inject(HttpClient);
  /**
   * Optional on purpose. `SwPush` is only provided when a service worker is
   * registered, which it is not in `ng serve` (provideServiceWorker is disabled
   * in dev mode) and not in unit tests. Injecting it non-optionally would make
   * this service — and everything that depends on it — impossible to construct
   * in exactly the environments where the feature is legitimately absent.
   */
  private readonly swPush = inject(SwPush, { optional: true });

  private readonly baseUrl = `${environment.apiBase}/api`;

  /** Null until asked for, `''` when the backend has no keys configured. */
  private vapidKey: string | null = null;

  private readonly subscribed = signal(false);
  private readonly configured = signal<boolean | null>(null);

  /** Whether this browser could receive a push at all. */
  readonly supported = computed(
    () =>
      this.swPush?.isEnabled === true &&
      typeof Notification !== 'undefined',
  );

  readonly state = computed<PushState>(() => {
    if (!this.supported()) return 'unsupported';
    if (this.configured() === false) return 'unconfigured';
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      return 'denied';
    }
    return this.subscribed() ? 'on' : 'off';
  });

  /** True once timers will ring without the page being open. */
  readonly ringsOnPhone = computed(() => this.state() === 'on');

  /**
   * Ask the backend whether the feature exists, once.
   *
   * A null public key means no VAPID configuration, which is a deployment state
   * rather than an error: the UI hides the offer instead of presenting a switch
   * that could not work.
   */
  private async loadKey(): Promise<string | null> {
    if (this.vapidKey !== null) {
      return this.vapidKey === '' ? null : this.vapidKey;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<{ publicKey: string | null }>(`${this.baseUrl}/push/key`),
      );
      this.vapidKey = response.publicKey ?? '';
      this.configured.set(this.vapidKey !== '');
      return response.publicKey ?? null;
    } catch {
      // Treated as unconfigured rather than retried: the only caller is a user
      // gesture, so they can simply press it again.
      this.configured.set(false);
      return null;
    }
  }

  /**
   * Subscribe this device.
   *
   * Must be called from a user gesture — `Notification.requestPermission()` is
   * ignored otherwise in most browsers, and silently so.
   */
  async enable(): Promise<boolean> {
    if (!this.supported() || !this.swPush) return false;

    const key = await this.loadKey();
    if (!key) return false;

    try {
      // requestSubscription asks for notification permission as part of
      // subscribing, so there is no separate requestPermission call here.
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: key,
      });
      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        return false;
      }

      await firstValueFrom(
        this.http.post<void>(`${this.baseUrl}/push/subscriptions`, {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      );
      this.subscribed.set(true);
      return true;
    } catch {
      // Refused permission, a push service that would not issue a subscription,
      // or a 401 because the session lapsed. None of them are recoverable here
      // and all of them mean the same thing to the caller.
      this.subscribed.set(false);
      return false;
    }
  }

  /**
   * Re-attach to an existing subscription on a later visit.
   *
   * The browser keeps the subscription across sessions, so a returning user is
   * already subscribed and must not be asked again. Deliberately does NOT call
   * requestSubscription, which would prompt.
   */
  async syncExistingSubscription(): Promise<void> {
    if (!this.supported() || !this.swPush) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        this.subscribed.set(true);
        await this.loadKey();
      }
    } catch {
      // No subscription to re-attach to. The offer stays visible.
    }
  }

  /**
   * Book a timer server-side.
   *
   * Sends a DURATION, never an instant: the backend does the arithmetic against
   * its own clock, so a phone that is minutes off still rings on time.
   *
   * Returns null on any failure, and the caller keeps its local countdown — a
   * timer that rings only while the app is open is worse than one that also
   * rings on the lock screen, but far better than none.
   */
  async schedule(title: string, body: string, seconds: number): Promise<string | null> {
    if (!this.ringsOnPhone()) return null;
    try {
      const timer = await firstValueFrom(
        this.http.post<ServerTimer>(`${this.baseUrl}/timers`, { title, body, seconds }),
      );
      return timer.id;
    } catch {
      return null;
    }
  }

  /** Withdraw a booking. A timer already rung or gone is not an error. */
  async cancel(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/timers/${id}`));
    } catch {
      // Already fired, already cancelled, or offline. Nothing to do either way.
    }
  }

  /** Timers the backend is still holding for this person. */
  async pending(): Promise<ServerTimer[]> {
    if (!this.supported()) return [];
    try {
      return await firstValueFrom(this.http.get<ServerTimer[]>(`${this.baseUrl}/timers`));
    } catch {
      return [];
    }
  }
}
