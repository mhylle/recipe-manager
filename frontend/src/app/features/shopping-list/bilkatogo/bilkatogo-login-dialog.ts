import { Component, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { BilkaToGoService } from './bilkatogo.service';

@Component({
  selector: 'app-bilkatogo-login-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div
        class="dialog card"
        role="dialog"
        aria-label="Log in to BilkaToGo"
        aria-modal="true"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
      >
        <h3>Log in to BilkaToGo</h3>
        <p class="dialog__subtitle">
          Enter your Salling Group credentials to send items to your BilkaToGo basket.
        </p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog__form">
          <div class="dialog__field">
            <label for="bilka-email" class="dialog__label">Email</label>
            <input
              id="bilka-email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div class="dialog__field">
            <label for="bilka-password" class="dialog__label">Password</label>
            <input
              id="bilka-password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <p class="dialog__error" role="alert">{{ error() }}</p>
          }

          <div class="dialog__actions">
            <button type="button" class="btn btn--ghost" (click)="closed.emit()">Cancel</button>
            <button type="submit" class="btn btn--primary" [disabled]="loading()">
              {{ loading() ? 'Logging in...' : 'Log in' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(45, 52, 51, 0.4);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .dialog {
      max-width: 420px;
      width: 90%;
      padding: 2rem;
      box-shadow: var(--shadow-elevated);
    }

    .dialog h3 {
      margin-bottom: 0.5rem;
    }

    .dialog__subtitle {
      color: var(--on-surface-variant);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    .dialog__form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .dialog__field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .dialog__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--on-surface);
    }

    .dialog__error {
      color: var(--error);
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `],
})
export class BilkaToGoLoginDialogComponent {
  private readonly bilkaToGoService = inject(BilkaToGoService);

  readonly loginSuccess = output<string>();
  readonly closed = output<void>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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
        if (err.status === 401) {
          this.error.set('Invalid credentials. Please try again.');
        } else {
          this.error.set('Connection error. Please try again.');
        }
      },
    });
  }
}
