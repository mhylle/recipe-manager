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
import { ProfileService } from '../../../features/profile/profile.service';
import { envelopeSupported, openKey } from '../../services/key-envelope';
import { TranslatePipe } from '../../i18n';

type KeyDialogError =
  | 'geminiKey.errPassphrase'
  | 'geminiKey.errRequired'
  | 'geminiKey.errUnsupported';

/**
 * Obtains a Gemini key for one generation run.
 *
 * Two ways in, and both end with a plaintext key handed to the caller and never
 * kept here:
 *
 *  - **unlock** — a stored envelope decrypted with the user's passphrase. The
 *    server cannot do this for them; it holds only ciphertext.
 *  - **paste** — a key used once and not saved. This is why generation takes the
 *    key as a request parameter rather than looking it up: someone may not want
 *    it stored at all.
 *
 * The dialog never writes anything. Saving a key is the profile page's job.
 */
@Component({
  selector: 'app-gemini-key-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './gemini-key-dialog.html',
  styleUrl: './gemini-key-dialog.scss',
})
export class GeminiKeyDialogComponent {
  private readonly profile = inject(ProfileService);

  /** The plaintext key, for this run only. */
  readonly unlocked = output<string>();
  readonly dismissed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly busy = signal(false);
  readonly errorKey = signal<KeyDialogError | null>(null);
  /** Null while the stored-key state is still loading. */
  readonly hasStoredKey = signal<boolean | null>(null);
  /** Set when the user chooses to paste instead of unlocking. */
  readonly pasting = signal(false);

  readonly supported = envelopeSupported();

  passphrase = '';
  apiKey = '';

  private envelope: string | null = null;

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
    });

    this.profile.getGeminiKey().subscribe({
      next: (state) => {
        this.envelope = state.envelope;
        this.hasStoredKey.set(state.configured && state.envelope !== null);
        // Nothing stored means there is nothing to unlock, so go straight to
        // the paste field rather than showing a passphrase box that cannot work.
        if (!state.configured) this.pasting.set(true);
      },
      error: () => {
        this.hasStoredKey.set(false);
        this.pasting.set(true);
      },
    });
  }

  usePasteInstead(): void {
    this.pasting.set(true);
    this.errorKey.set(null);
  }

  useStoredInstead(): void {
    this.pasting.set(false);
    this.errorKey.set(null);
    this.apiKey = '';
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.errorKey.set(null);

    if (this.pasting()) {
      if (!this.apiKey.trim()) {
        this.errorKey.set('geminiKey.errRequired');
        return;
      }
      const key = this.apiKey.trim();
      this.apiKey = '';
      this.finish(key);
      return;
    }

    if (!this.supported) {
      this.errorKey.set('geminiKey.errUnsupported');
      return;
    }
    if (!this.passphrase || this.envelope === null) {
      this.errorKey.set('geminiKey.errRequired');
      return;
    }

    this.busy.set(true);
    try {
      const key = await openKey(this.envelope, this.passphrase);
      this.passphrase = '';
      this.busy.set(false);
      this.finish(key);
    } catch {
      // A wrong passphrase and a tampered envelope are indistinguishable, and
      // mean the same thing to whoever is typing.
      this.busy.set(false);
      this.passphrase = '';
      this.errorKey.set('geminiKey.errPassphrase');
    }
  }

  private finish(key: string): void {
    this.close();
    this.unlocked.emit(key);
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
