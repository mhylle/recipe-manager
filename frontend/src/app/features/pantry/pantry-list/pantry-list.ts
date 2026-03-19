import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { PantryFiltersComponent, PantryFilters } from '../pantry-filters/pantry-filters';

@Component({
  selector: 'app-pantry-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ExpiryStatusPipe, PantryFiltersComponent],
  template: `
    <div class="pantry-list">
      <div class="pantry-list__header">
        <h2>Pantry Items</h2>
        <a routerLink="/pantry/new" class="btn btn--primary">Add Item</a>
      </div>

      <app-pantry-filters (filtersChanged)="onFiltersChanged($event)" />

      @if (items().length === 0) {
        <p class="pantry-list__empty" role="status">
          {{ hasActiveFilters() ? 'No items match the current filters.' : 'No pantry items yet. Add your first item to get started.' }}
        </p>
      } @else {
        <table class="pantry-list__table" aria-label="Pantry items">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Quantity</th>
              <th scope="col">Unit</th>
              <th scope="col">Category</th>
              <th scope="col">Expiry</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.id) {
              <tr>
                <td><a [routerLink]="['/pantry', item.id]">{{ item.name }}</a></td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.category }}</td>
                <td>
                  @if (item.expiryDate) {
                    @switch (item.expiryDate | expiryStatus) {
                      @case ('expired') { <span class="expiry-badge expiry-badge--expired" role="status">Expired</span> }
                      @case ('expiring-soon') { <span class="expiry-badge expiry-badge--expiring-soon" role="status">Expiring Soon</span> }
                      @case ('fresh') { <span class="expiry-badge expiry-badge--fresh">{{ item.expiryDate }}</span> }
                    }
                  } @else { <span class="expiry-badge expiry-badge--no-expiry">-</span> }
                </td>
                <td>
                  <a [routerLink]="['/pantry', item.id, 'edit']" class="btn btn--small">Edit</a>
                  <button type="button" class="btn btn--small btn--danger" (click)="onDelete(item)" [attr.aria-label]="'Delete ' + item.name">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .pantry-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .pantry-list__empty { text-align: center; padding: 2rem; color: #666; }
    .pantry-list__table { width: 100%; border-collapse: collapse; }
    .pantry-list__table th, .pantry-list__table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
    .pantry-list__table th { font-weight: 600; background-color: #f5f5f5; }
    .expiry-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .expiry-badge--expired { background-color: #fce4ec; color: #c62828; }
    .expiry-badge--expiring-soon { background-color: #fff3e0; color: #ef6c00; }
    .expiry-badge--fresh { background-color: #e8f5e9; color: #2e7d32; }
    .expiry-badge--no-expiry { color: #999; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; font-size: 0.875rem; }
    .btn--primary { background-color: #1976d2; color: white; }
    .btn--primary:hover { background-color: #1565c0; }
    .btn--small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
    .btn--danger { background-color: #d32f2f; color: white; margin-left: 0.5rem; }
    .btn--danger:hover { background-color: #c62828; }
  `],
})
export class PantryListComponent implements OnInit {
  private readonly pantryService = inject(PantryService);
  readonly items = signal<PantryItem[]>([]);
  private currentFilters: PantryFilters | null = null;

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
