import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PantrySharingService, type PantryMember } from './pantry-sharing.service';
import { PantryContextService } from '../../../shared/services/pantry-context.service';
import { LocaleService, TranslatePipe } from '../../../shared/i18n';
import { reloadOnKitchenChange } from '../../../shared/services/reload-on-kitchen-change';

/**
 * Who is in this kitchen.
 *
 * Invitations can only reach people who already have an mhylle.com account —
 * this app borrows identities rather than creating them — so an unknown address
 * reports the backend's own explanation instead of appearing to succeed.
 */
@Component({
  selector: 'app-pantry-sharing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './pantry-sharing.html',
  styleUrl: './pantry-sharing.scss',
})
export class PantrySharingComponent {
  private readonly sharing = inject(PantrySharingService);
  private readonly locale = inject(LocaleService);
  readonly context = inject(PantryContextService);

  readonly members = signal<PantryMember[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  /**
   * Load now, and again whenever the kitchen or the language changes.
   *
   * Was a bare `this.reload()` in the constructor, which silently did nothing:
   * the component is built before `/api/pantry/mine` resolves, so
   * `context.current()` was still null, `reload()` returned early, and the member
   * list stayed empty forever. The household looked empty even to its owner —
   * and it appeared to work only just after an invite, which reloads explicitly.
   *
   * Watching the revision also fixes switching kitchens, which previously kept
   * showing the previous household's members.
   */
  private readonly reloadOnChange = reloadOnKitchenChange(() => this.reload());

  reload(): void {
    const pantry = this.context.current();
    if (!pantry) return;
    this.sharing.members(pantry.id).subscribe({
      next: (m) => this.members.set(m),
      error: () => this.error.set(this.locale.translate('pantry.sharing.loadFailed')),
    });
  }

  invite(): void {
    const pantry = this.context.current();
    if (!pantry || this.emailControl.invalid) return;

    this.busy.set(true);
    this.error.set(null);
    this.sharing.invite(pantry.id, this.emailControl.value).subscribe({
      next: () => {
        this.busy.set(false);
        this.emailControl.reset();
        this.reload();
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        // The backend explains precisely why — no account, already a member —
        // and a generic "could not invite" would throw that away.
        this.error.set(err.error?.message ?? this.locale.translate('pantry.sharing.inviteFailed'));
      },
    });
  }

  remove(member: PantryMember): void {
    const pantry = this.context.current();
    if (!pantry) return;
    const question = member.isYou
      ? this.locale.translate('pantry.sharing.confirmLeave', { name: pantry.name })
      : this.locale.translate('pantry.sharing.confirmRemove', { name: member.displayName });
    if (!confirm(question)) return;

    this.sharing.remove(pantry.id, member.userId).subscribe({
      next: () => {
        if (member.isYou) {
          this.context.load();
        } else {
          this.reload();
        }
      },
      error: (err: { error?: { message?: string } }) =>
        this.error.set(err.error?.message ?? this.locale.translate('pantry.sharing.removeFailed')),
    });
  }
}
