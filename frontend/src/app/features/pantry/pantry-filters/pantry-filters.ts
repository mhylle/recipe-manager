import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';
import { EnumLabelPipe, TranslatePipe } from '../../../shared/i18n';

export interface PantryFilters {
  query: string;
  category: string;
}

@Component({
  selector: 'app-pantry-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, EnumLabelPipe],
  templateUrl: './pantry-filters.html',
  styleUrl: './pantry-filters.scss',
})
export class PantryFiltersComponent {
  readonly filtersChanged = output<PantryFilters>();
  readonly categoryOptions = Object.values(PantryCategory);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryControl = new FormControl('', { nonNullable: true });

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      category: this.categoryControl.value,
    });
  }

  resetFilters(): void {
    this.searchControl.reset();
    this.categoryControl.reset();
    this.emitFilters();
  }
}
