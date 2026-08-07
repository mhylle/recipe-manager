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
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  byteLength,
} from '../../services/password-policy';

type RegisterErrorKey =
  | 'register.errRequired'
  | 'register.errPasswordMismatch'
  | 'register.errPasswordWeak'
  | 'register.errPasswordLong'
  | 'register.errEmailTaken'
  | 'register.errTooMany'
  | 'register.errFailed';

/**
 * Self-service sign-up, fronting the estate's central auth-service.
 *
 * The auth-service has always supported `POST /api/auth/register`; this app just
 * never offered a way in, so every new cook needed the owner to create an
 * account by hand. Nothing is stored locally — credentials are forwarded and
 * forgotten, exactly as in the sign-in dialog.
 *
 * Registering does NOT grant contribution rights to the shared recipe library.
 * A new account can sign in, read every recipe and run its own kitchen; adding
 * recipes waits on an `apps` grant. The closing message says so, because an
 * unexplained missing button reads as a bug.
 */
@Component({
  selector: 'app-register-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './register-dialog.html',
  styleUrl: './register-dialog.scss',
})
export class RegisterDialogComponent {
  private readonly auth = inject(AuthService);

  readonly registered = output<void>();
  readonly dismissed = output<void>();
  /** Asks the host to swap this dialog for the sign-in one. */
  readonly wantsSignIn = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly emailRef = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly busy = signal(false);
  readonly errorKey = signal<RegisterErrorKey | null>(null);

  email = '';
  firstName = '';
  lastName = '';
  password = '';
  confirmPassword = '';

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        // showModal gives focus trapping, Escape-to-close and an inert
        // background for free, as in the sign-in dialog. The open-attribute
        // fallback keeps the form usable where showModal is missing rather than
        // throwing and rendering nothing.
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

    if (
      !this.email.trim() ||
      !this.firstName.trim() ||
      !this.lastName.trim() ||
      !this.password
    ) {
      this.errorKey.set('register.errRequired');
      return;
    }
    // Checked here as well as by the server: catching it before a round trip
    // saves burning one of five allowed attempts per minute on a typo.
    if (this.password !== this.confirmPassword) {
      this.errorKey.set('register.errPasswordMismatch');
      return;
    }
    // Mirrors the auth-service's shared password policy, which is now
    // length-only per NIST SP 800-63B (recipe-manager#47). Every character is
    // allowed — punctuation, spaces, non-ASCII — and no character class is
    // required. The old rule here banned everything outside letters and digits
    // and demanded a digit, which is exactly what rejected real passphrases.
    //
    // Checked before the request so a typo is named immediately rather than
    // burning one of the five attempts a minute nginx allows.
    if (this.password.length < PASSWORD_MIN_LENGTH) {
      this.errorKey.set('register.errPasswordWeak');
      return;
    }
    // Bytes, not characters: bcrypt truncates at 72 bytes, so this is where the
    // server stops looking. 'é' is one character but two bytes, so a form that
    // counted characters would pass something the server then refuses.
    if (byteLength(this.password) > PASSWORD_MAX_BYTES) {
      this.errorKey.set('register.errPasswordLong');
      return;
    }

    this.busy.set(true);
    this.errorKey.set(null);

    this.auth
      .register({
        email: this.email.trim(),
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        password: this.password,
      })
      .subscribe({
        next: (ok) => {
          this.busy.set(false);
          this.clearSecrets();
          if (!ok) {
            this.errorKey.set('register.errFailed');
            return;
          }
          this.close();
          this.registered.emit();
        },
        error: (err: { status?: number }) => {
          this.busy.set(false);
          this.clearSecrets();
          this.errorKey.set(this.errorFor(err.status));
        },
      });
  }

  /**
   * Distinguish the three failures a registrant can actually act on.
   *
   * 429 is the 5-per-minute brake on credential endpoints — reporting it as a
   * rejected address would send someone editing a perfectly good email. 409 is a
   * taken address, which means "sign in instead". 400 is the server's own
   * validation, which the checks above should already have caught.
   */
  private errorFor(status: number | undefined): RegisterErrorKey {
    if (status === 429) return 'register.errTooMany';
    if (status === 409) return 'register.errEmailTaken';
    // Now that the client mirrors the server's policy exactly, a 400 that still
    // arrives means the two have drifted apart again — so this says the password
    // was refused without inventing a reason the server did not give.
    if (status === 400) return 'register.errPasswordWeak';
    return 'register.errFailed';
  }

  private clearSecrets(): void {
    this.password = '';
    this.confirmPassword = '';
  }

  signInInstead(): void {
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
