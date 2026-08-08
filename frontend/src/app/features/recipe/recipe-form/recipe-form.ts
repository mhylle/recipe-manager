import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { Unit } from '../../../shared/enums/unit.enum';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';
import { EnumLabelPipe, LOCALES, LocaleService, TranslatePipe } from '../../../shared/i18n';
import type { Locale } from '../../../shared/i18n';
import { RecipeTranslation } from '../../../shared/models/translation.model';
import type { Recipe } from '../../../shared/models/recipe.model';
import type { RecipeVariationsAuthoring } from '../../../shared/models/variation-authoring.model';
import { PantryContextService } from '../../../shared/services/pantry-context.service';
import { VariationsEditorComponent } from './variations-editor/variations-editor';

/** The prose fields of the form, for one language. */
interface LocalisedDraft {
  name: string;
  description: string;
  instructions: string;
  ingredientNames: string[];
}

const EMPTY_DRAFT: LocalisedDraft = {
  name: '',
  description: '',
  instructions: '',
  ingredientNames: [],
};

@Component({
  selector: 'app-recipe-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    EnumLabelPipe,
    VariationsEditorComponent,
  ],
  templateUrl: './recipe-form.html',
  styleUrl: './recipe-form.scss',
})
export class RecipeFormComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly localeService = inject(LocaleService);
  private readonly pantryContext = inject(PantryContextService);

  readonly isEditMode = signal(false);
  private editId = '';

  readonly locales = LOCALES;

  /**
   * Which language's text the prose fields currently hold. Starts on the UI
   * language, but is independent of it — you can read the UI in English while
   * writing the Danish version.
   */
  readonly editingLocale = signal<Locale>(this.localeService.locale());

  /**
   * Text for the languages NOT currently in the form. The visible fields are the
   * live copy for `editingLocale`; switching tabs stashes them here and loads the
   * other language's text.
   */
  private readonly drafts = new Map<Locale, LocalisedDraft>();

  /** Locales with no name entered yet — surfaced so gaps are visible, not silent. */
  readonly missingLocales = signal<readonly Locale[]>([]);

  readonly unitOptions = Object.values(Unit);
  readonly difficultyOptions = Object.values(Difficulty);
  readonly categoryOptions = Object.values(PantryCategory);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    servings: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    prepTime: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    cookTime: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    difficulty: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tags: new FormControl('', { nonNullable: true }),
    instructions: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // Off by default: the shared library is the norm, and a recipe nobody
    // expected to be hidden is worse than one nobody expected to be shared.
    isPrivate: new FormControl(false, { nonNullable: true }),
    ingredients: new FormArray<FormGroup>([]),
  });

  /**
   * Whether the author has a kitchen to keep a private recipe in.
   *
   * With none, private still works but narrows to them alone, and the form says
   * so rather than letting someone assume a household saw it.
   */
  readonly hasKitchen = computed(() => this.pantryContext.currentId() !== null);

  get ingredientsArray(): FormArray {
    return this.form.controls.ingredients;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editId = id;
      this.recipeService.getById(id).subscribe((recipe) => {
        // Kept so a text edit can say WHICH step each line is. Variations point
        // at step ids, and a save that renumbered them would move somebody's
        // override onto a different instruction.
        this.loadedStepIds = (recipe.steps ?? []).map((step) => step.id);
        this.form.patchValue({
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          tags: recipe.tags.join(', '),
          // Absent reads as public — the same default a new recipe gets.
          isPrivate: recipe.isPrivate ?? false,
        });
        // Clear and re-populate ingredients (quantities/units are shared across
        // languages; only the names are localised).
        this.ingredientsArray.clear();
        recipe.ingredients.forEach((ing) => {
          this.ingredientsArray.push(
            this.createIngredientGroup(
              ing.id ?? null,
              '',
              ing.quantity,
              ing.unit,
              ing.pantryCategory,
            ),
          );
        });

        this.recipeService.getTranslations(id).subscribe((translations) => {
          this.loadDrafts(translations);
        });

        // The differences themselves, in every language, keyed by the ids they
        // point at — which is what editing needs and what the payload above,
        // already resolved for a reader, cannot say.
        this.recipeService.getVariationsForAuthoring(id).subscribe({
          next: (authoring) => this.authoringVariations.set(authoring),
          // Left null on purpose, and the panel does not appear. An editor that
          // showed "no variations" because the READ failed would let the next
          // save send an empty set and delete the ones that are there.
          error: () => this.authoringVariations.set(null),
        });
      });
    } else {
      // Start with one empty ingredient row
      this.addIngredient();
      this.refreshMissingLocales();
    }
  }

  /** Seed the per-language drafts from the API and show the current tab's text. */
  private loadDrafts(translations: readonly RecipeTranslation[]): void {
    this.drafts.clear();
    for (const t of translations) {
      this.drafts.set(t.locale, {
        name: t.name,
        description: t.description,
        instructions: t.instructions.join('\n'),
        ingredientNames: [...t.ingredientNames],
      });
    }
    this.applyDraft(this.editingLocale());
    this.refreshMissingLocales();
  }

  /** Stash the visible text, then show the chosen language's. */
  switchLocale(locale: Locale): void {
    if (locale === this.editingLocale()) {
      return;
    }
    this.captureDraft();
    this.editingLocale.set(locale);
    this.applyDraft(locale);
    this.refreshMissingLocales();
  }

  /** True when the server refused the save and said why. */
  readonly saveBlocked = signal(false);

  /** The recipe went in and its variations did not — a partial save, said out loud. */
  readonly variationsBlocked = signal(false);

  /** The variations as their author edits them. Null until they have loaded. */
  readonly authoringVariations = signal<RecipeVariationsAuthoring | null>(null);

  private readonly variationsEditor = viewChild(VariationsEditorComponent);

  /** A variation nobody can tell apart in the switcher is not saveable. */
  readonly variationsInvalid = computed(
    () => this.variationsEditor()?.hasNamelessVariation() ?? false,
  );

  /** The ids of the steps this form loaded, in order. Empty when creating. */
  private loadedStepIds: string[] = [];

  /**
   * Which existing step each line is, when that can be answered honestly.
   *
   * A textarea has no per-line identity, so this is only knowable while the
   * NUMBER of lines is unchanged — then line N is still step N and a pure text
   * edit keeps every id. Once a line is added or removed, nothing here knows
   * which one, so it says nothing and lets the server refuse if the recipe has
   * variations pointing at those steps. Guessing is what moved an override onto
   * the wrong instruction.
   */
  private stepIdsFor(lines: string[]): (string | null)[] | undefined {
    if (this.loadedStepIds.length === 0) return undefined;
    if (lines.length !== this.loadedStepIds.length) return undefined;
    return [...this.loadedStepIds];
  }

  private captureDraft(): void {
    const value = this.form.getRawValue();
    this.drafts.set(this.editingLocale(), {
      name: value.name,
      description: value.description,
      instructions: value.instructions,
      ingredientNames: value.ingredients.map((ing) => (ing['name'] as string) ?? ''),
    });
  }

  private applyDraft(locale: Locale): void {
    const draft = this.drafts.get(locale) ?? EMPTY_DRAFT;
    this.form.patchValue({
      name: draft.name,
      description: draft.description,
      instructions: draft.instructions,
    });
    this.ingredientsArray.controls.forEach((group, index) => {
      group.get('name')?.setValue(draft.ingredientNames[index] ?? '');
    });
  }

  private refreshMissingLocales(): void {
    const currentName = this.form.controls.name.value.trim();
    this.missingLocales.set(
      LOCALES.map((l) => l.code).filter((code) =>
        code === this.editingLocale()
          ? currentName.length === 0
          : !(this.drafts.get(code)?.name ?? '').trim(),
      ),
    );
  }

  protected isMissing(locale: Locale): boolean {
    return this.missingLocales().includes(locale);
  }

  addIngredient(): void {
    this.ingredientsArray.push(this.createIngredientGroup());
  }

  removeIngredient(index: number): void {
    this.ingredientsArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.form.invalid || this.variationsInvalid()) {
      return;
    }

    // Fold the visible fields back in so the tab being edited is not lost.
    this.captureDraft();

    const value = this.form.getRawValue();
    const authoringLocale = this.editingLocale();
    const own = this.drafts.get(authoringLocale) ?? EMPTY_DRAFT;

    const payload = {
      name: own.name,
      description: own.description,
      servings: value.servings,
      prepTime: value.prepTime,
      cookTime: value.cookTime,
      difficulty: value.difficulty as Difficulty,
      tags: value.tags ? value.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
      instructions: splitLines(own.instructions),
      stepIds: this.stepIdsFor(splitLines(own.instructions)),
      isPrivate: value.isPrivate,
      ingredients: value.ingredients.map((ing, index) => ({
        // Absent on a row the author just added, which is exactly what tells
        // the server to create one rather than update something.
        id: (ing['id'] as string | null) ?? undefined,
        name: own.ingredientNames[index] ?? '',
        quantity: Number(ing['quantity']),
        unit: ing['unit'] as Unit,
        pantryCategory: ing['pantryCategory'] as PantryCategory,
      })),
      // Every OTHER language that has text. Sending them on the same request keeps
      // the write atomic — a half-saved recipe with one language missing is worse
      // than a rejected save.
      translations: [...this.drafts.entries()]
        .filter(([locale, draft]) => locale !== authoringLocale && draft.name.trim().length > 0)
        .map(([locale, draft]) => ({
          locale,
          name: draft.name,
          description: draft.description,
          instructions: splitLines(draft.instructions),
          ingredientNames: draft.ingredientNames,
        })),
    };

    const done = () => {
      void this.router.navigate(['/recipes']);
    };
    // A 400 here is the server refusing to guess which step is which — see
    // stepIdsFor. Navigating away would lose the edit AND the reason.
    const failed = () => this.saveBlocked.set(true);
    if (this.isEditMode()) {
      this.recipeService.update(this.editId, payload, authoringLocale).subscribe({
        next: (updated) => this.saveVariations(updated, done),
        error: failed,
      });
    } else {
      this.recipeService
        .create(payload, authoringLocale)
        .subscribe({ next: done, error: failed });
    }
  }

  /**
   * The variations, once the recipe itself is in.
   *
   * Two requests, because they are two writes with different rules — and only
   * ever the second one when the author actually opened the panel. A save that
   * does not touch the variations is the safest round trip there is: the ciabatta
   * cannot lose an override to a form that never sent one.
   */
  private saveVariations(updated: Recipe, done: () => void): void {
    const editor = this.variationsEditor();
    if (!editor?.touched()) {
      done();
      return;
    }

    // Anything pointing at a step or an ingredient the save just removed goes
    // with it. The database has already cascaded those rows away; sending their
    // ids would be a foreign key that no longer resolves.
    const liveSteps = new Set((updated.steps ?? []).map((step) => step.id));
    const liveIngredients = new Set(
      (updated.ingredients ?? []).map((ing) => ing.id).filter(Boolean),
    );
    const variations = editor.toPayload().map((variation) => ({
      ...variation,
      steps: (variation.steps ?? []).filter(
        (step) => !step.stepId || liveSteps.has(step.stepId),
      ),
      ingredients: (variation.ingredients ?? []).filter(
        (ing) => !ing.ingredientId || liveIngredients.has(ing.ingredientId),
      ),
    }));

    this.recipeService.replaceVariations(this.editId, variations).subscribe({
      next: done,
      // The recipe went in and this did not. Saying so beats navigating away as
      // though both had.
      error: () => this.variationsBlocked.set(true),
    });
  }

  onNameInput(): void {
    // Keep the "missing translation" markers honest as the user types.
    this.refreshMissingLocales();
  }

  private createIngredientGroup(
    id: string | null = null,
    name = '',
    quantity = 0,
    unit: string = Unit.G,
    pantryCategory: string = PantryCategory.OTHER,
  ): FormGroup {
    return new FormGroup({
      // Which existing ingredient this row is. Carried through the form so a
      // save can say so: variations point at ingredient ids, and that link
      // cascades on delete, so a save that recreated the list silently took
      // every "10 g of yeast" with it.
      id: new FormControl<string | null>(id),
      name: new FormControl(name, { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl(quantity, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      unit: new FormControl(unit, { nonNullable: true, validators: [Validators.required] }),
      pantryCategory: new FormControl(pantryCategory, { nonNullable: true, validators: [Validators.required] }),
    });
  }
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
