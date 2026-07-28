import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * The slice of the Screen Wake Lock API we use. Typed locally because
 * `lib.dom` in this TypeScript version does not declare it.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Keeps the screen awake while cooking.
 *
 * Phones blank the screen after a minute or two, which is exactly wrong when the
 * recipe is propped on the counter and your hands are covered in flour.
 *
 * Two behaviours the platform forces on us:
 *  - the browser releases the lock whenever the tab is hidden, so it has to be
 *    re-acquired on `visibilitychange` or it silently stops working after the
 *    first time you switch apps;
 *  - `request()` must be called from a user gesture, so this is only ever driven
 *    by an explicit toggle, never automatically on page load.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private readonly document = inject(DOCUMENT);

  private sentinel: WakeLockSentinelLike | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    // Tear down on injector destruction. Without this the visibilitychange
    // listener outlives the service: it keeps firing, re-acquiring the screen
    // lock for an instance nobody is using. Caught by a test where a service
    // from an earlier case kept reacting to events in a later one.
    inject(DestroyRef).onDestroy(() => void this.disable());
  }

  /** Whether the user has asked for the screen to stay awake. */
  readonly enabled = signal(false);

  /** Whether a lock is actually held right now. False while the tab is hidden. */
  readonly active = signal(false);

  /** False on browsers without the API — the UI hides the toggle rather than lying. */
  readonly supported = signal(this.detectSupport());

  private detectSupport(): boolean {
    const nav = this.document.defaultView?.navigator as
      | (Navigator & { wakeLock?: WakeLockLike })
      | undefined;
    return typeof nav?.wakeLock?.request === 'function';
  }

  private get wakeLock(): WakeLockLike | undefined {
    const nav = this.document.defaultView?.navigator as
      | (Navigator & { wakeLock?: WakeLockLike })
      | undefined;
    return nav?.wakeLock;
  }

  async toggle(): Promise<void> {
    if (this.enabled()) {
      await this.disable();
    } else {
      await this.enable();
    }
  }

  async enable(): Promise<void> {
    if (!this.supported()) {
      return;
    }
    this.enabled.set(true);
    await this.acquire();

    if (!this.visibilityHandler) {
      // The lock dies when the tab is hidden; take it again on return, but only
      // while the user still wants it.
      this.visibilityHandler = () => {
        if (this.document.visibilityState === 'visible' && this.enabled()) {
          void this.acquire();
        } else {
          this.active.set(false);
        }
      };
      this.document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  async disable(): Promise<void> {
    this.enabled.set(false);
    if (this.visibilityHandler) {
      this.document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    await this.release();
  }

  private async acquire(): Promise<void> {
    if (this.sentinel && !this.sentinel.released) {
      return;
    }
    try {
      const sentinel = await this.wakeLock!.request('screen');
      this.sentinel = sentinel;
      this.active.set(true);
      // The platform can drop the lock on its own (low battery, for one).
      // Reflect that rather than claiming the screen is still held.
      sentinel.addEventListener('release', () => this.active.set(false));
    } catch {
      // Denied or unavailable — leave the intent set so returning to the tab
      // retries, but do not claim a lock we do not hold.
      this.active.set(false);
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.active.set(false);
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // Already gone. Nothing to do.
      }
    }
  }
}
