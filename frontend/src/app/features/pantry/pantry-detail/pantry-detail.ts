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
        <h1>{{ item()!.name }}</h1>

        <div class="card pantry-detail__card">
          <dl class="detail-list">
            <dt class="label-text">Quantity</dt>
            <dd>{{ item()!.quantity }} {{ item()!.unit }}</dd>

            <dt class="label-text">Category</dt>
            <dd>{{ item()!.category }}</dd>

            @if (item()!.barcode) {
              <dt class="label-text">Barcode</dt>
              <dd>{{ item()!.barcode }}</dd>
            }

            @if (item()!.expiryDate) {
              <dt class="label-text">Expiry Date</dt>
              <dd>{{ item()!.expiryDate }}</dd>
            }

            <dt class="label-text">Added</dt>
            <dd>{{ item()!.addedDate }}</dd>

            <dt class="label-text">Last Updated</dt>
            <dd>{{ item()!.lastUpdated }}</dd>
          </dl>
        </div>

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
          <a routerLink="/pantry" class="btn btn--ghost">Back to List</a>
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

    .pantry-detail h1 {
      margin-bottom: 1.5rem;
    }

    .pantry-detail__card {
      padding: 2rem;
    }

    .detail-list {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 0.75rem 1rem;
    }

    .detail-list dt {
      align-self: center;
    }

    .detail-list dd {
      margin: 0;
      color: var(--on-surface);
      font-size: 0.9375rem;
    }

    .detail-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
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
