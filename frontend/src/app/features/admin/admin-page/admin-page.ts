import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminService, type AdminUser } from '../admin.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TranslatePipe } from '../../../shared/i18n';

/**
 * Who may add to the shared recipe collection.
 *
 * Only the owner can reach the API behind this — OwnerGuard decides, and this
 * page merely reflects it. A grant made here takes effect on that person's very
 * next request, which is the reason the page exists: granting through the
 * auth-service instead waits for their next sign-in, and longer for an MCP key.
 */
@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPageComponent {
  private readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  /** The id currently being changed, so only that row's control is disabled. */
  readonly saving = signal<string | null>(null);
  readonly failed = signal(false);
  /** Distinguishes "no users" from "you may not look". */
  readonly forbidden = signal(false);

  constructor() {
    this.auth.checkAuth();
    this.admin.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.forbidden.set(err.status === 403 || err.status === 401);
        this.failed.set(!this.forbidden());
      },
    });
  }

  toggle(user: AdminUser): void {
    if (this.saving() !== null) return;
    this.saving.set(user.id);
    this.failed.set(false);

    this.admin.setContributor(user.id, !user.localContributor).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        );
        this.saving.set(null);
      },
      error: () => {
        this.saving.set(null);
        this.failed.set(true);
      },
    });
  }

  /**
   * Whether withdrawing here would actually stop them contributing.
   *
   * Someone holding the auth-service grant keeps access regardless, and saying so
   * beats a switch that appears to do nothing.
   */
  keepsAccessAnyway(user: AdminUser): boolean {
    return user.appGrant && !user.localContributor;
  }
}
