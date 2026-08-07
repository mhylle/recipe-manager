import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ProfileService,
  type GeminiKeyState,
  type McpKeyView,
} from '../profile.service';
import { AuthService } from '../../../shared/services/auth.service';
import { envelopeSupported, sealKey } from '../../../shared/services/key-envelope';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/i18n';
import {
  PASSWORD_MIN_LENGTH,
  checkPassword,
} from '../../../shared/services/password-policy';

type ProfileMessage =
  | 'profile.gemini.saved'
  | 'profile.gemini.removed'
  | 'profile.gemini.errRequired'
  | 'profile.gemini.errPassphraseShort'
  | 'profile.gemini.errMismatch'
  | 'profile.gemini.errUnsupported'
  | 'profile.gemini.errFailed';

type PasswordMessage =
  | 'profile.password.changed'
  | 'profile.password.errRequired'
  | 'profile.password.errMismatch'
  | 'profile.password.errWeak'
  | 'profile.password.errLong'
  | 'profile.password.errSame'
  | 'profile.password.errWrongCurrent'
  | 'profile.password.errTooMany'
  | 'profile.password.errFailed';

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
  imports: [FormsModule, RouterLink, TranslatePipe],
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

  // --- Password ------------------------------------------------------------

  readonly passwordBusy = signal(false);
  readonly passwordMessage = signal<PasswordMessage | null>(null);
  readonly passwordMessageIsError = computed(() => {
    const key = this.passwordMessage();
    return key !== null && key.includes('.err');
  });

  /** Surfaced in the hint so the rule is stated before it is broken. */
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  /**
   * Change the account password.
   *
   * Everything checkable locally is checked first — the endpoint is throttled
   * alongside login, so a mismatch or a too-short password must not spend one of
   * the allowed attempts. Only `currentPassword` being wrong needs the server.
   */
  changePassword(): void {
    if (this.passwordBusy()) {
      return;
    }
    if (!this.currentPassword || !this.newPassword) {
      this.passwordMessage.set('profile.password.errRequired');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage.set('profile.password.errMismatch');
      return;
    }
    if (this.newPassword === this.currentPassword) {
      // Not a server rule, but a change that changes nothing is a mistake worth
      // naming rather than reporting as success.
      this.passwordMessage.set('profile.password.errSame');
      return;
    }
    const problem = checkPassword(this.newPassword);
    if (problem === 'tooShort') {
      this.passwordMessage.set('profile.password.errWeak');
      return;
    }
    if (problem === 'tooLong') {
      this.passwordMessage.set('profile.password.errLong');
      return;
    }

    this.passwordBusy.set(true);
    this.passwordMessage.set(null);

    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (ok) => {
        this.passwordBusy.set(false);
        this.clearPasswordFields();
        this.passwordMessage.set(
          ok ? 'profile.password.changed' : 'profile.password.errFailed',
        );
      },
      error: (err: { status?: number }) => {
        this.passwordBusy.set(false);
        // The new password is cleared but the current one is not: if the server
        // says it was wrong, retyping the whole form to fix one field is a
        // pointless punishment.
        this.newPassword = '';
        this.confirmNewPassword = '';
        this.passwordMessage.set(this.passwordErrorFor(err.status));
      },
    });
  }

  /**
   * 401 here means the CURRENT password was wrong, not that the session expired
   * — the request only reached validation because the cookie was accepted. 429
   * is the throttle this endpoint shares with login, and reporting it as a wrong
   * password would send someone hunting for a mistake they did not make.
   */
  private passwordErrorFor(status: number | undefined): PasswordMessage {
    if (status === 429) return 'profile.password.errTooMany';
    if (status === 401 || status === 403) {
      return 'profile.password.errWrongCurrent';
    }
    if (status === 400) return 'profile.password.errWeak';
    return 'profile.password.errFailed';
  }

  private clearPasswordFields(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
  }

  // --- MCP keys ------------------------------------------------------------

  readonly mcpKeys = signal<McpKeyView[]>([]);
  readonly mcpBusy = signal(false);
  /**
   * The token from the most recent creation, held only in memory.
   *
   * Shown once and never fetched again — the backend stores a hash, so this is
   * genuinely the only moment it exists outside the user's clipboard.
   */
  readonly freshToken = signal<string | null>(null);
  readonly mcpErrorKey = signal<'profile.mcp.errFailed' | 'profile.mcp.errLabel' | null>(null);

  mcpLabel = '';

  constructor() {
    this.auth.checkAuth();
    this.reload();
  }

  /** Whether a key is still usable, for the revoke affordance. */
  isActive(key: McpKeyView): boolean {
    return key.revokedAt === null;
  }

  createMcpKey(): void {
    if (this.mcpBusy()) return;
    if (!this.mcpLabel.trim()) {
      this.mcpErrorKey.set('profile.mcp.errLabel');
      return;
    }
    this.mcpBusy.set(true);
    this.mcpErrorKey.set(null);
    this.freshToken.set(null);

    this.profile.createMcpKey(this.mcpLabel.trim()).subscribe({
      next: (created) => {
        this.mcpLabel = '';
        this.freshToken.set(created.token);
        this.mcpKeys.update((keys) => [created, ...keys]);
        this.mcpBusy.set(false);
      },
      error: () => {
        this.mcpBusy.set(false);
        this.mcpErrorKey.set('profile.mcp.errFailed');
      },
    });
  }

  revokeMcpKey(id: string): void {
    if (this.mcpBusy()) return;
    this.mcpBusy.set(true);
    this.mcpErrorKey.set(null);

    this.profile.revokeMcpKey(id).subscribe({
      next: () => {
        // Marked rather than removed, mirroring the backend: a key that vanishes
        // looks like one that never existed.
        this.mcpKeys.update((keys) =>
          keys.map((key) =>
            key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key,
          ),
        );
        this.mcpBusy.set(false);
      },
      error: () => {
        this.mcpBusy.set(false);
        this.mcpErrorKey.set('profile.mcp.errFailed');
      },
    });
  }

  /** Dismiss the shown-once token, so it does not linger on screen. */
  dismissToken(): void {
    this.freshToken.set(null);
  }

  private reload(): void {
    this.profile.getGeminiKey().subscribe({
      next: (state) => this.state.set(state),
      // A guest, or an unreachable API. Either way there is nothing to show, and
      // the template falls back to the signed-out state.
      error: () => this.state.set(null),
    });
    this.profile.listMcpKeys().subscribe({
      next: (keys) => this.mcpKeys.set(keys),
      error: () => this.mcpKeys.set([]),
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
