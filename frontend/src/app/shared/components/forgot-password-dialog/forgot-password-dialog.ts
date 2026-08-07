import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n';

type ForgotError = 'forgot.errEmail' | 'forgot.errTooMany' | 'forgot.errFailed';

/**
 * Asks the auth-service to send a password-reset link.
 *
 * Only the REQUEST half lives here. The link itself lands on the estate's
 * existing reset page at /portals/reset-password, and a second page in this app
 * consuming the same token would be two implementations of one flow, free to
 * drift apart.
 *
 * The confirmation deliberately does not say whether the address had an account.
 * Anything else turns this form into a way to discover who is registered.
 */
@Component({
  selector: 'app-forgot-password-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './forgot-password-dialog.html',
  styleUrl: './forgot-password-dialog.scss',
})
export class ForgotPasswordDialogComponent {
  private readonly auth = inject(AuthService);

  readonly dismissed = output<void>();
  /** Asks the host to reopen sign-in. */
  readonly wantsSignIn = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly emailRef = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly busy = signal(false);
  readonly errorKey = signal<ForgotError | null>(null);
  readonly sent = signal(false);

  email = '';

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
        queueMicrotask(() => this.emailRef()?.nativeElement.focus());
      }
    });
  }

  submit(): void {
    if (this.busy()) return;
    const email = this.email.trim();
    // A shape check only. Whether the address exists is the server's business,
    // and deliberately not ours to reveal.
    if (!email || !email.includes('@')) {
      this.errorKey.set('forgot.errEmail');
      return;
    }

    this.busy.set(true);
    this.errorKey.set(null);

    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (err: { status?: number }) => {
        this.busy.set(false);
        // 429 is the same 5-per-minute brake as sign-in. Reporting it as a
        // failure would have someone retyping a correct address.
        this.errorKey.set(err.status === 429 ? 'forgot.errTooMany' : 'forgot.errFailed');
      },
    });
  }

  backToSignIn(): void {
    this.close();
    this.wantsSignIn.emit();
  }

  cancel(): void {
    this.close();
    this.dismissed.emit();
  }

  private close(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog?.open) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }
}
