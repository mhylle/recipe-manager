import { Injectable, signal } from '@angular/core';

/**
 * Lets any page ask for the sign-in dialog.
 *
 * The dialog itself lives once in the layout — rendering one per page would
 * mean several <dialog> elements competing for the top layer. This is the
 * signal they share.
 */
@Injectable({ providedIn: 'root' })
export class LoginPromptService {
  readonly open$ = signal(false);

  open(): void {
    this.open$.set(true);
  }

  close(): void {
    this.open$.set(false);
  }
}
