import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { StaplesService } from '../staples.service';
import { TranslatePipe } from '../../../shared/i18n';

@Component({
  selector: 'app-staples-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './staples-config.html',
  styleUrl: './staples-config.scss',
})
export class StaplesConfigComponent implements OnInit {
  private readonly staplesService = inject(StaplesService);

  readonly items = signal<string[]>([]);
  readonly newStapleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  ngOnInit(): void {
    this.loadStaples();
  }

  addStaple(): void {
    const name = this.newStapleControl.value.trim();
    if (!name) return;

    const current = this.items();
    if (current.some((s) => s.toLowerCase() === name.toLowerCase())) {
      return; // already exists
    }

    const updated = [...current, name];
    this.staplesService.updateStaples({ items: updated }).subscribe(() => {
      this.items.set(updated);
      this.newStapleControl.reset();
    });
  }

  removeStaple(item: string): void {
    const updated = this.items().filter((s) => s !== item);
    this.staplesService.updateStaples({ items: updated }).subscribe(() => {
      this.items.set(updated);
    });
  }

  private loadStaples(): void {
    this.staplesService.getStaples().subscribe((config) => {
      this.items.set(config.items);
    });
  }
}
