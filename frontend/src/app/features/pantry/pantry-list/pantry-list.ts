import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { PantryFiltersComponent, PantryFilters } from '../pantry-filters/pantry-filters';
import { PantrySharingComponent } from '../pantry-sharing/pantry-sharing';
import { PantryContextService } from '../../../shared/services/pantry-context.service';
import { LoginPromptService } from '../../../shared/services/login-prompt.service';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';
import {
  EnumLabelPipe,
  LocaleDatePipe,
  LocaleNumberPipe,
  LocaleService,
  TranslatePipe,
} from '../../../shared/i18n';
import { reloadOnKitchenChange } from '../../../shared/services/reload-on-kitchen-change';

@Component({
  selector: 'app-pantry-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, ExpiryStatusPipe, PantryFiltersComponent, PantrySharingComponent, KeyValuePipe, TranslatePipe, EnumLabelPipe, LocaleDatePipe, LocaleNumberPipe],
  templateUrl: './pantry-list.html',
  styleUrl: './pantry-list.scss',
})
export class PantryListComponent {
  private readonly pantryService = inject(PantryService);
  private readonly locale = inject(LocaleService);
  /**
   * Which kitchen we are looking at, and — importantly — WHY it might be empty.
   * "Not signed in", "no kitchen yet" and "an empty kitchen" look identical if
   * you only check the item count.
   */
  readonly context = inject(PantryContextService);
  private readonly loginPrompt = inject(LoginPromptService);
  readonly items = signal<PantryItem[]>([]);
  private currentFilters: PantryFilters | null = null;

  readonly groupedItems = computed(() => {
    const map = new Map<PantryCategory, PantryItem[]>();
    for (const item of this.items()) {
      const category = item.category || PantryCategory.OTHER;
      const existing = map.get(category) ?? [];
      existing.push(item);
      map.set(category, existing);
    }
    return map;
  });

  // Re-fetches when the language OR the signed-in kitchen changes.
  private readonly reload = reloadOnKitchenChange(() => this.loadItems());

  constructor() {
    // Resolve the kitchen alongside its contents, so the page can explain an
    // empty list rather than just showing one.
    this.context.load();
  }

  signIn(): void {
    this.loginPrompt.open();
  }

  // --- Creating a kitchen ---------------------------------------------------

  /**
   * Prefilled so the common case is one click.
   *
   * Translated rather than built by concatenation, because "X's kitchen" does not
   * assemble the same way in Danish.
   */
  newPantryName = this.locale.translate('pantry.create.defaultName');
  readonly creating = signal(false);
  readonly createFailed = signal(false);

  createPantry(): void {
    const name = this.newPantryName.trim();
    if (this.creating() || !name) return;

    this.creating.set(true);
    this.createFailed.set(false);
    this.context.create(name).subscribe({
      next: () => {
        this.creating.set(false);
        // context.create() reloads, which flips the state to 'ready'; the items
        // for the brand-new kitchen still have to be fetched.
        this.loadItems();
      },
      error: () => {
        this.creating.set(false);
        this.createFailed.set(true);
      },
    });
  }

  hasActiveFilters(): boolean {
    if (!this.currentFilters) return false;
    return !!(this.currentFilters.query || this.currentFilters.category);
  }

  onFiltersChanged(filters: PantryFilters): void {
    this.currentFilters = filters;
    this.loadItems(filters);
  }

  onDelete(item: PantryItem): void {
    if (confirm(this.locale.translate('common.confirm.delete', { name: item.name }))) {
      this.pantryService.delete(item.id).subscribe(() => { this.loadItems(this.currentFilters ?? undefined); });
    }
  }

  /** Re-fetch from the API. Public: the locale effect and the specs both drive it. */
  loadItems(filters?: PantryFilters): void {
    this.pantryService.getAll().subscribe({
      error: () => this.items.set([]),
      next: (items) => {
        let filtered = items;
        if (filters?.query) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter((item) => item.name.toLowerCase().includes(q));
        }
        if (filters?.category) {
          filtered = filtered.filter((item) => item.category === filters.category);
        }
        this.items.set(filtered);
      },
    });
  }
}
