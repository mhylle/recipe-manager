import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecipeService } from '../../../features/recipe/recipe.service';
import {
  PantrySharingService,
  type PantryMember,
} from '../../../features/pantry/pantry-sharing/pantry-sharing.service';
import { PantryContextService } from '../../services/pantry-context.service';
import { TranslatePipe, type TranslationKey } from '../../i18n';
import type { Recipe } from '../../models/recipe.model';

/**
 * Hand a recipe to someone you cook with.
 *
 * Deliberately a confirm step and not a one-tap action. Transferring gives away
 * control: `createdById` is what every write is checked against, so afterwards
 * the previous author can no longer edit or delete the recipe — and if it is
 * private and they are not in its kitchen, they stop seeing it entirely. The
 * dialog names the recipient and says so before the button does anything.
 *
 * The recipient list is the current kitchen's members, which is also what the
 * server enforces. Someone not in a kitchen with you cannot be chosen here and
 * would be refused there.
 *
 * A native <dialog> driven by showModal(), matching every other modal here:
 * that is what supplies the focus trap, the Esc key and top-layer stacking.
 */
@Component({
  selector: 'app-transfer-recipe-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './transfer-recipe-dialog.html',
  styleUrl: './transfer-recipe-dialog.scss',
})
export class TransferRecipeDialogComponent {
  private readonly recipes = inject(RecipeService);
  private readonly sharing = inject(PantrySharingService);
  private readonly context = inject(PantryContextService);

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly recipe = input.required<Recipe>();

  /** Emits the updated recipe, so the page can re-render its byline. */
  readonly transferred = output<Recipe>();
  readonly cancelled = output<void>();

  readonly members = signal<PantryMember[]>([]);
  readonly error = signal<TranslationKey | null>(null);
  readonly busy = signal(false);
  readonly loading = signal(true);

  readonly recipientControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  /** Everyone in this kitchen except the person doing the handing over. */
  readonly candidates = computed(() => this.members().filter((m) => !m.isYou));

  /** The chosen person, for naming them in the confirmation line. */
  readonly chosen = signal<PantryMember | null>(null);

  /**
   * Set once the transfer has landed.
   *
   * Closing the element fires the dialog's own `close` event, which is also how
   * Esc and the Cancel button arrive — so without this, a successful transfer
   * would emit `cancelled` immediately after `transferred` and report one action
   * as two.
   */
  private settled = false;

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog && !dialog.open) {
        // The attribute fallback keeps the dialog usable where showModal is
        // missing; it loses the focus trap but not the content.
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
    });

    const pantryId = this.context.currentId();
    if (!pantryId) {
      this.loading.set(false);
      return;
    }
    this.sharing.members(pantryId).subscribe({
      next: (rows) => {
        this.members.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('recipe.transfer.loadFailed');
        this.loading.set(false);
      },
    });
  }

  onSelect(userId: string): void {
    this.recipientControl.setValue(userId);
    this.chosen.set(this.candidates().find((m) => m.userId === userId) ?? null);
  }

  confirm(): void {
    const userId = this.recipientControl.value;
    if (!userId || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);

    this.recipes.transferAuthor(this.recipe().id, userId).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.settled = true;
        this.close();
        this.transferred.emit(updated);
      },
      error: () => {
        // The server re-checks the membership this list was built from, so a
        // failure here is worth showing rather than assuming it cannot happen.
        this.busy.set(false);
        this.error.set('recipe.transfer.failed');
      },
    });
  }

  cancel(): void {
    if (this.settled) {
      return;
    }
    this.close();
    this.cancelled.emit();
  }

  /**
   * Close the element itself.
   *
   * Needed because the parent removes this component with an @if: a <dialog>
   * torn out of the DOM while still open leaves the top layer and the page's
   * inertness behind it, which reads as a frozen page.
   */
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
