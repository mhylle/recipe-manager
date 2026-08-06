import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageSwitcherComponent } from '../shared/i18n/language-switcher/language-switcher';
import { LoginDialogComponent } from '../shared/components/login-dialog/login-dialog';
import { RegisterDialogComponent } from '../shared/components/register-dialog/register-dialog';
import { AuthService } from '../shared/services/auth.service';
import { PantryContextService } from '../shared/services/pantry-context.service';
import { LoginPromptService } from '../shared/services/login-prompt.service';
import { TranslatePipe } from '../shared/i18n';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LanguageSwitcherComponent,
    LoginDialogComponent,
    RegisterDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  private readonly pantryContext = inject(PantryContextService);

  private readonly prompt = inject(LoginPromptService);

  /** Open when the header asks, or when any page asks via LoginPromptService. */
  readonly loginOpen = this.prompt.open$;

  /**
   * Sign-up is local state rather than another prompt service.
   *
   * Nothing outside this component ever needs to demand it — it is only ever
   * reached from the sign-in dialog, which is where someone discovers they have
   * no account.
   */
  readonly registerOpen = signal(false);

  openLogin(): void {
    this.prompt.open();
  }

  onSignedIn(): void {
    this.prompt.close();
    // The kitchen is per-user, so it has to be resolved again for the person who
    // just arrived — otherwise the pantry stays showing the signed-out state
    // until a manual reload.
    this.pantryContext.load();
  }

  onDismissed(): void {
    this.prompt.close();
  }

  /** Swap sign-in for sign-up. Never both at once. */
  openRegister(): void {
    this.prompt.close();
    this.registerOpen.set(true);
  }

  onRegistered(): void {
    this.registerOpen.set(false);
    // register() signs the new account in, so this is a real arrival and the
    // kitchen has to be resolved exactly as after any other sign-in.
    this.onSignedIn();
  }

  onRegisterDismissed(): void {
    this.registerOpen.set(false);
  }

  backToSignIn(): void {
    this.registerOpen.set(false);
    this.prompt.open();
  }

  signOut(): void {
    this.auth.logout().subscribe(() => this.pantryContext.load());
  }
}
