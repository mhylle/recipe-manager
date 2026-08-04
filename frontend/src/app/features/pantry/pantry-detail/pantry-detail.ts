import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { PantryItem } from '../../../shared/models/pantry-item.model';
import {
  EnumLabelPipe,
  LocaleDatePipe,
  LocaleNumberPipe,
  LocaleService,
  TranslatePipe,
} from '../../../shared/i18n';
import { reloadOnKitchenChange } from '../../../shared/services/reload-on-kitchen-change';

@Component({
  selector: 'app-pantry-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, LocaleDatePipe, LocaleNumberPipe],
  templateUrl: './pantry-detail.html',
  styleUrl: './pantry-detail.scss',
})
export class PantryDetailComponent {
  private readonly pantryService = inject(PantryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);

  readonly item = signal<PantryItem | null>(null);

  // Re-fetches when the language OR the signed-in kitchen changes.
  private readonly reload = reloadOnKitchenChange(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.pantryService.getById(id).subscribe((item) => {
        this.item.set(item);
      });
    }
  });

  onDelete(): void {
    const currentItem = this.item();
    if (
      currentItem &&
      confirm(this.locale.translate('common.confirm.delete', { name: currentItem.name }))
    ) {
      this.pantryService.delete(currentItem.id).subscribe(() => {
        this.router.navigate(['/pantry']);
      });
    }
  }
}
