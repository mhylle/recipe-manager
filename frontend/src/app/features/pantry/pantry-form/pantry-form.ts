import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PantryService } from '../pantry.service';
import { Unit } from '../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';
import { EnumLabelPipe, LOCALES, LocaleService, TranslatePipe } from '../../../shared/i18n';
import type { Locale } from '../../../shared/i18n';

@Component({
  selector: 'app-pantry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, EnumLabelPipe],
  templateUrl: './pantry-form.html',
  styleUrl: './pantry-form.scss',
})
export class PantryFormComponent implements OnInit {
  private readonly pantryService = inject(PantryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly localeService = inject(LocaleService);

  readonly isEditMode = signal(false);
  private editId = '';

  readonly locales = LOCALES;

  /** Which language the name field holds. Independent of the UI language. */
  readonly editingLocale = signal<Locale>(this.localeService.locale());

  /** Names for the languages not currently in the field. */
  private readonly drafts = new Map<Locale, string>();

  readonly missingLocales = signal<readonly Locale[]>([]);

  readonly unitOptions = Object.values(Unit);
  readonly categoryOptions = Object.values(PantryCategory);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    unit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    barcode: new FormControl('', { nonNullable: true }),
    expiryDate: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editId = id;
      this.pantryService.getById(id).subscribe((item) => {
        this.form.patchValue({
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          barcode: item.barcode ?? '',
          expiryDate: item.expiryDate ?? '',
        });
        this.pantryService.getTranslations(id).subscribe((translations) => {
          this.drafts.clear();
          for (const t of translations) {
            this.drafts.set(t.locale, t.name);
          }
          this.form.controls.name.setValue(this.drafts.get(this.editingLocale()) ?? '');
          this.refreshMissingLocales();
        });
      });
    } else {
      this.refreshMissingLocales();
    }
  }

  /** Stash the visible name, then show the chosen language's. */
  switchLocale(locale: Locale): void {
    if (locale === this.editingLocale()) {
      return;
    }
    this.drafts.set(this.editingLocale(), this.form.controls.name.value);
    this.editingLocale.set(locale);
    this.form.controls.name.setValue(this.drafts.get(locale) ?? '');
    this.refreshMissingLocales();
  }

  onNameInput(): void {
    this.refreshMissingLocales();
  }

  protected isMissing(locale: Locale): boolean {
    return this.missingLocales().includes(locale);
  }

  private refreshMissingLocales(): void {
    const current = this.form.controls.name.value.trim();
    this.missingLocales.set(
      LOCALES.map((l) => l.code).filter((code) =>
        code === this.editingLocale() ? current.length === 0 : !(this.drafts.get(code) ?? '').trim(),
      ),
    );
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    // Fold the visible name back in so the open tab is not lost.
    this.drafts.set(this.editingLocale(), this.form.controls.name.value);

    const value = this.form.getRawValue();
    const authoringLocale = this.editingLocale();
    const payload = {
      name: this.drafts.get(authoringLocale) ?? '',
      quantity: value.quantity,
      unit: value.unit as Unit,
      category: value.category as PantryCategory,
      ...(value.barcode ? { barcode: value.barcode } : {}),
      ...(value.expiryDate ? { expiryDate: value.expiryDate } : {}),
      translations: [...this.drafts.entries()]
        .filter(([locale, name]) => locale !== authoringLocale && name.trim().length > 0)
        .map(([locale, name]) => ({ locale, name })),
    };

    const done = () => this.router.navigate(['/pantry']);
    if (this.isEditMode()) {
      this.pantryService.update(this.editId, payload, authoringLocale).subscribe(done);
    } else {
      this.pantryService.create(payload, authoringLocale).subscribe(done);
    }
  }
}
