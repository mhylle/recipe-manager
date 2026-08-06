import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileService, type GeminiKeyState } from '../profile.service';
import { AuthService } from '../../../shared/services/auth.service';
import { envelopeSupported, sealKey } from '../../../shared/services/key-envelope';
import { TranslatePipe } from '../../../shared/i18n';

type ProfileMessage =
  | 'profile.gemini.saved'
  | 'profile.gemini.removed'
  | 'profile.gemini.errRequired'
  | 'profile.gemini.errPassphraseShort'
  | 'profile.gemini.errMismatch'
  | 'profile.gemini.errUnsupported'
  | 'profile.gemini.errFailed';

/**
 * A cook's own settings.
 *
 * The Gemini key is encrypted here, in the browser, before it is sent. The plain
 * key is held only in this component's field, is cleared the moment it has been
 * sealed, and is never rendered back — which is why the page can only ever tell
 * you *that* a key is stored, not what it is. Losing the passphrase means
 * entering the key again, and that is the intended trade: the server cannot help
 * recover it because it cannot read it.
 */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePageComponent {
  private readonly profile = inject(ProfileService);
  readonly auth = inject(AuthService);

  readonly state = signal<GeminiKeyState | null>(null);
  readonly busy = signal(false);
  readonly message = signal<ProfileMessage | null>(null);
  /** Distinguishes a confirmation from a problem, for styling and aria. */
  readonly messageIsError = computed(() => {
    const key = this.message();
    return key !== null && key.includes('.err');
  });

  readonly supported = envelopeSupported();

  apiKey = '';
  passphrase = '';
  confirmPassphrase = '';

  constructor() {
    this.auth.checkAuth();
    this.reload();
  }

  private reload(): void {
    this.profile.getGeminiKey().subscribe({
      next: (state) => this.state.set(state),
      // A guest, or an unreachable API. Either way there is nothing to show, and
      // the template falls back to the signed-out state.
      error: () => this.state.set(null),
    });
  }

  async save(): Promise<void> {
    if (this.busy()) return;
    if (!this.supported) {
      this.message.set('profile.gemini.errUnsupported');
      return;
    }
    if (!this.apiKey.trim() || !this.passphrase) {
      this.message.set('profile.gemini.errRequired');
      return;
    }
    // Short passphrases are the weak point of the whole scheme: the envelope is
    // only as strong as what derives it, and an offline attacker gets unlimited
    // guesses against a stolen copy.
    if (this.passphrase.length < 8) {
      this.message.set('profile.gemini.errPassphraseShort');
      return;
    }
    if (this.passphrase !== this.confirmPassphrase) {
      this.message.set('profile.gemini.errMismatch');
      return;
    }

    this.busy.set(true);
    this.message.set(null);
    try {
      const envelope = await sealKey(this.apiKey, this.passphrase);
      // Cleared before the request, not after: the sealed copy is what travels,
      // and the plaintext has no further use.
      this.clearSecrets();

      this.profile.saveGeminiKey(envelope).subscribe({
        next: (state) => {
          this.state.set(state);
          this.busy.set(false);
          this.message.set('profile.gemini.saved');
        },
        error: () => {
          this.busy.set(false);
          this.message.set('profile.gemini.errFailed');
        },
      });
    } catch {
      // Sealing failed — a browser without WebCrypto, or a refused operation.
      // The pre-checks above cover the cases a user can act on, so anything
      // reaching here is reported as a generic failure rather than guessed at.
      this.busy.set(false);
      this.clearSecrets();
      this.message.set('profile.gemini.errFailed');
    }
  }

  remove(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    this.profile.deleteGeminiKey().subscribe({
      next: () => {
        this.state.set({ configured: false, envelope: null, updatedAt: null });
        this.busy.set(false);
        this.message.set('profile.gemini.removed');
      },
      error: () => {
        this.busy.set(false);
        this.message.set('profile.gemini.errFailed');
      },
    });
  }

  private clearSecrets(): void {
    this.apiKey = '';
    this.passphrase = '';
    this.confirmPassphrase = '';
  }
}
