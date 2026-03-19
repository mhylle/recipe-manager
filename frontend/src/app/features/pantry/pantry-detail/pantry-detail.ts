import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';

@Component({
  selector: 'app-pantry-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (item()) {
      <div class="pantry-detail">
        <h2>{{ item()!.name }}</h2>

        <dl class="detail-list">
          <dt>Quantity</dt>
          <dd>{{ item()!.quantity }} {{ item()!.unit }}</dd>

          <dt>Category</dt>
          <dd>{{ item()!.category }}</dd>

          @if (item()!.barcode) {
            <dt>Barcode</dt>
            <dd>{{ item()!.barcode }}</dd>
          }

          @if (item()!.expiryDate) {
            <dt>Expiry Date</dt>
            <dd>{{ item()!.expiryDate }}</dd>
          }

          <dt>Added</dt>
          <dd>{{ item()!.addedDate }}</dd>

          <dt>Last Updated</dt>
          <dd>{{ item()!.lastUpdated }}</dd>
        </dl>

        <div class="detail-actions">
          <a [routerLink]="['/pantry', item()!.id, 'edit']" class="btn btn--primary">Edit</a>
          <button
            type="button"
            class="btn btn--danger"
            (click)="onDelete()"
            [attr.aria-label]="'Delete ' + item()!.name"
          >
            Delete
          </button>
          <a routerLink="/pantry" class="btn btn--secondary">Back to List</a>
        </div>
      </div>
    } @else {
      <p role="status">Loading...</p>
    }
  `,
  styles: [`
    .pantry-detail {
      max-width: 600px;
    }

    .detail-list {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 0.5rem;
      margin: 1.5rem 0;
    }

    .detail-list dt {
      font-weight: 600;
      color: #555;
    }

    .detail-list dd {
      margin: 0;
    }

    .detail-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .btn--primary {
      background-color: #1976d2;
      color: white;
    }

    .btn--danger {
      background-color: #d32f2f;
      color: white;
    }

    .btn--secondary {
      background-color: #757575;
      color: white;
    }
  `],
})
export class PantryDetailComponent implements OnInit {
  private readonly pantryService = inject(PantryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly item = signal<PantryItem | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.pantryService.getById(id).subscribe((item) => {
        this.item.set(item);
      });
    }
  }

  onDelete(): void {
    const currentItem = this.item();
    if (currentItem && confirm(`Are you sure you want to delete "${currentItem.name}"?`)) {
      this.pantryService.delete(currentItem.id).subscribe(() => {
        this.router.navigate(['/pantry']);
      });
    }
  }
}
