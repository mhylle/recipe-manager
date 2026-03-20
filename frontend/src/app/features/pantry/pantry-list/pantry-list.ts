import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { PantryFiltersComponent, PantryFilters } from '../pantry-filters/pantry-filters';

@Component({
  selector: 'app-pantry-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ExpiryStatusPipe, PantryFiltersComponent, KeyValuePipe],
  template: `
    <div class="pantry-list">
      <div class="pantry-list__header">
        <div>
          <h1>The Pantry</h1>
          <p class="pantry-list__subtitle">A curated inventory of your essential ingredients.</p>
        </div>
        <a routerLink="/pantry/new" class="btn btn--primary">Add Item</a>
      </div>

      <app-pantry-filters (filtersChanged)="onFiltersChanged($event)" />

      @if (items().length === 0) {
        <div class="card pantry-list__empty" role="status">
          <p>{{ hasActiveFilters() ? 'No items match the current filters.' : 'No pantry items yet. Add your first item to get started.' }}</p>
        </div>
      } @else {
        @for (entry of groupedItems() | keyvalue; track entry.key) {
          <section class="pantry-list__category">
            <h3 class="pantry-list__category-heading">
              <span class="pantry-list__category-dot"></span>
              {{ entry.key }}
            </h3>
            <div class="card">
              @for (item of entry.value; track item.id) {
                <div class="pantry-list__row">
                  <a [routerLink]="['/pantry', item.id]" class="pantry-list__name">{{ item.name }}</a>
                  <span class="pantry-list__qty">{{ item.quantity }} {{ item.unit }}</span>
                  <span class="pantry-list__expiry">
                    @if (item.expiryDate) {
                      @switch (item.expiryDate | expiryStatus) {
                        @case ('expired') { <span class="expiry-badge expiry-badge--expired" role="status">Expired</span> }
                        @case ('expiring-soon') { <span class="expiry-badge expiry-badge--expiring-soon" role="status">Expiring Soon</span> }
                        @case ('fresh') { <span class="expiry-badge expiry-badge--fresh" role="status">{{ item.expiryDate }}</span> }
                      }
                    } @else {
                      <span class="expiry-badge expiry-badge--none">&mdash;</span>
                    }
                  </span>
                  <div class="pantry-list__actions">
                    <a [routerLink]="['/pantry', item.id, 'edit']" class="btn btn--small btn--ghost">Edit</a>
                    <button type="button" class="btn btn--small btn--text" (click)="onDelete(item)" [attr.aria-label]="'Delete ' + item.name">Delete</button>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .pantry-list__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;
    }

    .pantry-list__header h1 {
      margin-bottom: 0.25rem;
    }

    .pantry-list__subtitle {
      font-family: var(--font-body);
      color: var(--on-surface-variant);
      font-size: 1rem;
    }

    .pantry-list__empty {
      text-align: center;
      padding: 3rem var(--spacing-card);
      color: var(--on-surface-variant);
    }

    .pantry-list__category {
      margin-bottom: 1.5rem;
    }

    .pantry-list__category-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-transform: capitalize;
      margin-bottom: 0.75rem;
    }

    .pantry-list__category-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--primary);
    }

    .pantry-list__row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }

    .pantry-list__row + .pantry-list__row {
      border-top: 1px solid var(--outline-variant);
    }

    .pantry-list__name {
      flex: 1;
      font-weight: 500;
      color: var(--on-surface);
      text-decoration: none;
    }

    .pantry-list__name:hover {
      color: var(--primary);
    }

    .pantry-list__qty {
      font-size: 0.875rem;
      color: var(--on-surface-variant);
      min-width: 80px;
      text-align: right;
    }

    .pantry-list__expiry {
      min-width: 110px;
      text-align: center;
    }

    .pantry-list__actions {
      display: flex;
      gap: 0.25rem;
      min-width: 120px;
      justify-content: flex-end;
    }

    .expiry-badge {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: var(--radius-full);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .expiry-badge--expired {
      background: var(--error-container);
      color: var(--error);
    }

    .expiry-badge--expiring-soon {
      background: var(--secondary-container);
      color: var(--secondary);
    }

    .expiry-badge--fresh {
      background: var(--primary-container);
      color: var(--primary);
    }

    .expiry-badge--none {
      color: var(--on-surface-variant);
      opacity: 0.4;
    }

    @media (max-width: 640px) {
      .pantry-list__header {
        flex-direction: column;
      }

      .pantry-list__row {
        flex-wrap: wrap;
      }

      .pantry-list__qty,
      .pantry-list__expiry {
        min-width: auto;
        text-align: left;
      }

      .pantry-list__actions {
        min-width: auto;
        width: 100%;
        justify-content: flex-start;
      }
    }
  `],
})
export class PantryListComponent implements OnInit {
  private readonly pantryService = inject(PantryService);
  readonly items = signal<PantryItem[]>([]);
  private currentFilters: PantryFilters | null = null;

  readonly groupedItems = computed(() => {
    const map = new Map<string, PantryItem[]>();
    for (const item of this.items()) {
      const category = item.category || 'other';
      const existing = map.get(category) ?? [];
      existing.push(item);
      map.set(category, existing);
    }
    return map;
  });

  ngOnInit(): void { this.loadItems(); }

  hasActiveFilters(): boolean {
    if (!this.currentFilters) return false;
    return !!(this.currentFilters.query || this.currentFilters.category);
  }

  onFiltersChanged(filters: PantryFilters): void {
    this.currentFilters = filters;
    this.loadItems(filters);
  }

  onDelete(item: PantryItem): void {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      this.pantryService.delete(item.id).subscribe(() => { this.loadItems(this.currentFilters ?? undefined); });
    }
  }

  private loadItems(filters?: PantryFilters): void {
    this.pantryService.getAll().subscribe((items) => {
      let filtered = items;
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        filtered = filtered.filter((item) => item.name.toLowerCase().includes(q));
      }
      if (filters?.category) {
        filtered = filtered.filter((item) => item.category === filters.category);
      }
      this.items.set(filtered);
    });
  }
}
