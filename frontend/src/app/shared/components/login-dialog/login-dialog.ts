import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n';

/**
 * The errors this dialog can show. Typed as a union rather than `string` so the
 * `t` pipe still checks the key against the dictionary — a typo'd key would
 * otherwise render as itself on screen.
 */
type LoginErrorKey =
  | 'login.errRequired'
  | 'login.errBadCredentials'
  | 'login.errTooMany';

/**
 * Sign-in dialog, fronting the estate's central auth-service.
 *
 * Credentials POST straight to `/api/auth/login`, which sets the shared
 * `auth_token` cookie for all of mhylle.com. No redirect, and this app never
 * stores a password — it forwards one and forgets it.
 *
 * The endpoint is rate-limited to 5 requests a minute by nginx, so a rejected
 * attempt says so rather than looking like a wrong password.
 */
@Component({
  selector: 'app-login-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './login-dialog.html',
  styleUrl: './login-dialog.scss',
})
export class LoginDialogComponent {
  private readonly auth = inject(AuthService);

  readonly signedIn = output<void>();
  readonly dismissed = output<void>();
  /** Asks the host to swap this dialog for the sign-up one. */
  readonly wantsRegister = output<void>();
  /** Asks the host to swap this dialog for the password-reset request. */
  readonly wantsPasswordReset = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly emailRef = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly busy = signal(false);
  /** Translation key of the current error, so the message follows the language. */
  readonly errorKey = signal<LoginErrorKey | null>(null);

  email = '';
  password = '';

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        // showModal gives focus trapping, Escape-to-close and an inert
        // background for free — all things a hand-rolled overlay gets wrong.
        // Falling back to the open attribute keeps the dialog usable (just not
        // modal) anywhere showModal is missing, rather than throwing and
        // rendering nothing at all.
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
    if (!this.email.trim() || !this.password) {
      this.errorKey.set('login.errRequired');
      return;
    }

    this.busy.set(true);
    this.errorKey.set(null);

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (ok) => {
        this.busy.set(false);
        if (!ok) {
          this.errorKey.set('login.errBadCredentials');
          return;
        }
        this.password = '';
        this.close();
        this.signedIn.emit();
      },
      error: (err: { status?: number }) => {
        this.busy.set(false);
        this.password = '';
        // 429 is nginx's brute-force brake (5/min on credential endpoints).
        // Reporting it as "wrong password" would send someone hunting for a
        // typo that is not there.
        this.errorKey.set(
          err.status === 429 ? 'login.errTooMany' : 'login.errBadCredentials',
        );
      },
    });
  }

  registerInstead(): void {
    this.close();
    this.wantsRegister.emit();
  }

  forgotPassword(): void {
    this.close();
    this.wantsPasswordReset.emit();
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
