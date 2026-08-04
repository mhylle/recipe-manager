import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageSwitcherComponent } from '../shared/i18n/language-switcher/language-switcher';
import { LoginDialogComponent } from '../shared/components/login-dialog/login-dialog';
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

  signOut(): void {
    this.auth.logout().subscribe(() => this.pantryContext.load());
  }
}
