import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

/**
 * Notices when a new build has been downloaded and is waiting.
 *
 * Angular's service worker fetches an update in the background and activates it
 * on the *next* navigation. Without this the app says nothing, so the first load
 * after every deploy renders the previous build — which during the auth work
 * meant showing write buttons the server had just started rejecting. On an
 * installed phone app "next navigation" can be days away.
 *
 * It deliberately does not reload on its own. Swapping the page out from under
 * someone mid-recipe, or mid-timer, is worse than showing a stale header for a
 * few minutes. The user decides when.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate, { optional: true });

  readonly updateAvailable = signal(false);

  constructor() {
    // Absent in dev and in any browser without service-worker support.
    if (!this.updates?.isEnabled) {
      return;
    }

    const subscription = this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateAvailable.set(true));

    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** Activate the waiting version and reload into it. */
  async applyUpdate(): Promise<void> {
    try {
      await this.updates?.activateUpdate();
    } catch {
      // Activation can fail if the worker has already moved on; the reload
      // below still lands the user on the newest build either way.
    }
    document.location.reload();
  }
}
