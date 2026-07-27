import { Component, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { BilkaToGoService } from './bilkatogo.service';
import { TranslatePipe } from '../../../shared/i18n';
import type { TranslationKey } from '../../../shared/i18n';

@Component({
  selector: 'app-bilkatogo-login-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  templateUrl: './bilkatogo-login-dialog.html',
  styleUrl: './bilkatogo-login-dialog.scss',
})
export class BilkaToGoLoginDialogComponent {
  private readonly bilkaToGoService = inject(BilkaToGoService);

  readonly loginSuccess = output<string>();
  readonly closed = output<void>();

  readonly loading = signal(false);

  /**
   * Holds the KEY, not the resolved message — the template translates at render
   * time, so a visible error follows a language switch instead of staying frozen
   * in whichever language it was raised in.
   */
  readonly error = signal<TranslationKey | null>(null);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
  });

  onSubmit(): void {
    const { email, password } = this.form.getRawValue();
    if (!email || !password) return;

    this.loading.set(true);
    this.error.set(null);

    this.bilkaToGoService.login(email, password).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.loginSuccess.emit(response.sessionId);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401
            ? 'bilkatogo.login.errorInvalid'
            : 'bilkatogo.login.errorConnection',
        );
      },
    });
  }
}
