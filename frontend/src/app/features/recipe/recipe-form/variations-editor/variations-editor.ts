import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, signal } from '@angular/core';
import { EnumLabelPipe, LOCALES, TranslatePipe } from '../../../../shared/i18n';
import type { Locale } from '../../../../shared/i18n';
import { Unit } from '../../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../../shared/enums/pantry-category.enum';
import type {
  AuthoringBaseIngredient,
  AuthoringBaseStep,
  AuthoringVariation,
  RecipeVariationsAuthoring,
  VariationIngredientWrite,
  VariationStepWrite,
  VariationWrite,
} from '../../../../shared/models/variation-authoring.model';

/** Text held per language while it is being written. */
type ByLocale = Partial<Record<Locale, string>>;

/**
 * What a variation does to ONE base step. Absent from the record means shared —
 * and that absence is the whole design, see the class comment.
 */
interface StepChangeDraft {
  mode: 'override' | 'skip';
  texts: ByLocale;
}

interface InsertedStepDraft {
  key: string;
  afterPosition: number;
  texts: ByLocale;
}

interface IngredientChangeDraft {
  mode: 'change' | 'remove';
  quantity: number | null;
  unit: Unit | null;
  pantryCategory: PantryCategory | null;
}

interface AddedIngredientDraft {
  key: string;
  names: ByLocale;
  quantity: number;
  unit: Unit;
  pantryCategory: PantryCategory;
}

interface VariationDraft {
  key: string;
  /** The variation this already is. Null for one being added now. */
  id: string | null;
  names: ByLocale;
  notes: ByLocale;
  prepTime: number | null;
  cookTime: number | null;
  /** Keyed by BASE STEP ID. A step with no entry here is shared. */
  stepChanges: Record<string, StepChangeDraft>;
  insertedSteps: InsertedStepDraft[];
  /** Keyed by BASE INGREDIENT ID. */
  ingredientChanges: Record<string, IngredientChangeDraft>;
  addedIngredients: AddedIngredientDraft[];
}

let keySeed = 0;
const nextKey = () => `k${++keySeed}`;

const byLocaleFrom = <T,>(rows: T[], text: (row: T) => string, locale: (row: T) => string): ByLocale => {
  const out: ByLocale = {};
  for (const row of rows) {
    const code = locale(row) as Locale;
    if (LOCALES.some((l) => l.code === code)) {
      out[code] = text(row);
    }
  }
  return out;
};

const hasText = (texts: ByLocale): boolean =>
  LOCALES.some((l) => (texts[l.code] ?? '').trim().length > 0);

/**
 * Authoring the ways a recipe can be cooked, as DIFFERENCES.
 *
 * The design constraint this component exists to satisfy: the ciabatta overrides
 * 2 of its 18 steps and shares the other 16. A panel that presented all 18 as
 * editable text would get all 18 filled in, and the duplication the schema was
 * chosen to prevent would come back through the UI instead.
 *
 * So a shared step is not a control at all. It is static text with a "change"
 * button beside it, and only pressing that button creates somewhere to type.
 * Overriding everything is not discouraged here, it is work — while sharing is
 * the thing that happens if you do nothing. The running count above the list
 * ("16 shared, 2 changed") keeps the number the schema cares about in front of
 * the author, and an override left identical to the shared text is dropped on
 * save rather than stored as a copy.
 */
@Component({
  selector: 'app-variations-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, EnumLabelPipe],
  templateUrl: './variations-editor.html',
  styleUrl: './variations-editor.scss',
})
export class VariationsEditorComponent {
  /**
   * Null until the recipe's variations have loaded.
   *
   * Defaulted rather than `required`, and not as a convenience: the parent's
   * submit button asks this component whether it is saveable, and on the first
   * change detection that question arrives BEFORE Angular has set the input —
   * which a required input answers by throwing NG0950. "Not loaded yet" is a
   * real state here, so it has a real value.
   */
  readonly authoring = input<RecipeVariationsAuthoring | null>(null);

  /** Which language is being written, from the form's own tabs. */
  readonly editingLocale = input.required<Locale>();

  readonly unitOptions = Object.values(Unit);
  readonly categoryOptions = Object.values(PantryCategory);

  /**
   * Reseeded whenever the loaded variations change, and locally writable in
   * between — which is exactly `linkedSignal`, and avoids an effect that writes
   * to state.
   */
  readonly variations = linkedSignal<RecipeVariationsAuthoring | null, VariationDraft[]>({
    source: this.authoring,
    computation: (loaded) => (loaded ? loaded.variations.map(draftOf) : []),
  });

  /**
   * Whether anything here has been touched.
   *
   * The parent only sends variations when this is true. A recipe whose author
   * came to fix a typo must not have its variations rewritten at all — the
   * safest round trip is the one that never happens.
   */
  readonly touched = linkedSignal<RecipeVariationsAuthoring | null, boolean>({
    source: this.authoring,
    computation: () => false,
  });

  /** Which variation is open. One at a time: this is editing differences to ONE way of cooking. */
  readonly expandedKey = signal<string | null>(null);

  readonly baseSteps = computed<AuthoringBaseStep[]>(() => this.authoring()?.baseSteps ?? []);
  readonly baseIngredients = computed<AuthoringBaseIngredient[]>(
    () => this.authoring()?.baseIngredients ?? [],
  );

  /** A variation with no name in any language cannot be told apart in the switcher. */
  readonly hasNamelessVariation = computed(() =>
    this.variations().some((v) => !hasText(v.names)),
  );

  /**
   * The places a step can be inserted: before the first, between each pair, and
   * after the last. One list rather than a button in two templates, so an
   * inserted step is offered in exactly the same way everywhere.
   */
  readonly gapPositions = computed(() =>
    Array.from({ length: this.baseSteps().length + 1 }, (_, index) => index),
  );

  isExpanded(key: string): boolean {
    return this.expandedKey() === key;
  }

  toggle(key: string): void {
    this.expandedKey.update((current) => (current === key ? null : key));
  }

  /* ------------------------------------------------------------ the variation */

  addVariation(): void {
    const draft: VariationDraft = {
      key: nextKey(),
      id: null,
      names: {},
      notes: {},
      prepTime: null,
      cookTime: null,
      stepChanges: {},
      insertedSteps: [],
      ingredientChanges: {},
      addedIngredients: [],
    };
    this.variations.update((list) => [...list, draft]);
    this.touched.set(true);
    this.expandedKey.set(draft.key);
  }

  removeVariation(key: string): void {
    this.variations.update((list) => list.filter((v) => v.key !== key));
    this.touched.set(true);
  }

  nameOf(v: VariationDraft): string {
    return v.names[this.editingLocale()] ?? '';
  }

  noteOf(v: VariationDraft): string {
    return v.notes[this.editingLocale()] ?? '';
  }

  setName(key: string, event: Event): void {
    const value = inputValue(event);
    this.patch(key, (v) => ({ ...v, names: { ...v.names, [this.editingLocale()]: value } }));
  }

  setNote(key: string, event: Event): void {
    const value = inputValue(event);
    this.patch(key, (v) => ({ ...v, notes: { ...v.notes, [this.editingLocale()]: value } }));
  }

  setPrepTime(key: string, event: Event): void {
    const minutes = numberOrNull(inputValue(event));
    this.patch(key, (v) => ({ ...v, prepTime: minutes }));
  }

  setCookTime(key: string, event: Event): void {
    const minutes = numberOrNull(inputValue(event));
    this.patch(key, (v) => ({ ...v, cookTime: minutes }));
  }

  /** Named in at least one language. Without that it cannot be told apart in the switcher. */
  hasAnyName(v: VariationDraft): boolean {
    return hasText(v.names);
  }

  /** Named, but not in the language currently being written — the gap the form's tabs mark. */
  missingNameHere(v: VariationDraft): boolean {
    return !(v.names[this.editingLocale()] ?? '').trim();
  }

  /* ----------------------------------------------------------------- the steps */

  stepChange(v: VariationDraft, stepId: string): StepChangeDraft | undefined {
    return v.stepChanges[stepId];
  }

  /** The shared text, which is what a step reads unless this variation changes it. */
  sharedStepText(stepId: string): string {
    const step = this.baseSteps().find((s) => s.id === stepId);
    return textFor(step?.texts ?? [], this.editingLocale());
  }

  stepText(v: VariationDraft, stepId: string): string {
    return v.stepChanges[stepId]?.texts[this.editingLocale()] ?? '';
  }

  /**
   * Start overriding a step — seeded with the shared text, so the author edits
   * rather than retypes. An override left identical is dropped on save, so the
   * convenience cannot quietly turn into a copy.
   */
  overrideStep(key: string, stepId: string): void {
    this.patch(key, (v) => ({
      ...v,
      stepChanges: {
        ...v.stepChanges,
        [stepId]: {
          mode: 'override',
          texts: v.stepChanges[stepId]?.texts ?? this.sharedTextsOf(stepId),
        },
      },
    }));
  }

  skipStep(key: string, stepId: string): void {
    this.patch(key, (v) => ({
      ...v,
      stepChanges: { ...v.stepChanges, [stepId]: { mode: 'skip', texts: {} } },
    }));
  }

  /** Back to shared — which is the state that stores nothing at all. */
  shareStep(key: string, stepId: string): void {
    this.patch(key, (v) => {
      const { [stepId]: _dropped, ...rest } = v.stepChanges;
      return { ...v, stepChanges: rest };
    });
  }

  setStepText(key: string, stepId: string, event: Event): void {
    const value = inputValue(event);
    this.patch(key, (v) => ({
      ...v,
      stepChanges: {
        ...v.stepChanges,
        [stepId]: {
          mode: 'override',
          texts: { ...(v.stepChanges[stepId]?.texts ?? {}), [this.editingLocale()]: value },
        },
      },
    }));
  }

  /** `afterPosition` counts BASE steps, so it still means the same place when one is skipped. */
  insertStep(key: string, afterPosition: number): void {
    this.patch(key, (v) => ({
      ...v,
      insertedSteps: [...v.insertedSteps, { key: nextKey(), afterPosition, texts: {} }],
    }));
  }

  removeInsertedStep(key: string, stepKey: string): void {
    this.patch(key, (v) => ({
      ...v,
      insertedSteps: v.insertedSteps.filter((s) => s.key !== stepKey),
    }));
  }

  setInsertedStepText(key: string, stepKey: string, event: Event): void {
    const value = inputValue(event);
    this.patch(key, (v) => ({
      ...v,
      insertedSteps: v.insertedSteps.map((s) =>
        s.key === stepKey ? { ...s, texts: { ...s.texts, [this.editingLocale()]: value } } : s,
      ),
    }));
  }

  insertedStepText(step: InsertedStepDraft): string {
    return step.texts[this.editingLocale()] ?? '';
  }

  insertedAfter(v: VariationDraft, position: number): InsertedStepDraft[] {
    return v.insertedSteps.filter((s) => s.afterPosition === position);
  }

  /* ----------------------------------------------------------- the ingredients */

  ingredientChange(v: VariationDraft, ingredientId: string): IngredientChangeDraft | undefined {
    return v.ingredientChanges[ingredientId];
  }

  sharedIngredientName(ingredient: AuthoringBaseIngredient): string {
    return nameFor(ingredient.names, this.editingLocale());
  }

  changeIngredient(key: string, ingredient: AuthoringBaseIngredient): void {
    this.patch(key, (v) => ({
      ...v,
      ingredientChanges: {
        ...v.ingredientChanges,
        [ingredient.id]: {
          mode: 'change',
          quantity: v.ingredientChanges[ingredient.id]?.quantity ?? ingredient.quantity,
          unit: v.ingredientChanges[ingredient.id]?.unit ?? ingredient.unit,
          pantryCategory:
            v.ingredientChanges[ingredient.id]?.pantryCategory ?? ingredient.pantryCategory,
        },
      },
    }));
  }

  dropIngredient(key: string, ingredientId: string): void {
    this.patch(key, (v) => ({
      ...v,
      ingredientChanges: {
        ...v.ingredientChanges,
        [ingredientId]: { mode: 'remove', quantity: null, unit: null, pantryCategory: null },
      },
    }));
  }

  shareIngredient(key: string, ingredientId: string): void {
    this.patch(key, (v) => {
      const { [ingredientId]: _dropped, ...rest } = v.ingredientChanges;
      return { ...v, ingredientChanges: rest };
    });
  }

  setIngredientQuantity(key: string, ingredientId: string, event: Event): void {
    const quantity = numberOrNull(inputValue(event));
    this.patchIngredient(key, ingredientId, (c) => ({ ...c, quantity }));
  }

  setIngredientUnit(key: string, ingredientId: string, event: Event): void {
    const unit = inputValue(event) as Unit;
    this.patchIngredient(key, ingredientId, (c) => ({ ...c, unit }));
  }

  addIngredient(key: string): void {
    this.patch(key, (v) => ({
      ...v,
      addedIngredients: [
        ...v.addedIngredients,
        {
          key: nextKey(),
          names: {},
          quantity: 0,
          unit: Unit.G,
          pantryCategory: PantryCategory.OTHER,
        },
      ],
    }));
  }

  removeAddedIngredient(key: string, ingredientKey: string): void {
    this.patch(key, (v) => ({
      ...v,
      addedIngredients: v.addedIngredients.filter((i) => i.key !== ingredientKey),
    }));
  }

  addedName(ingredient: AddedIngredientDraft): string {
    return ingredient.names[this.editingLocale()] ?? '';
  }

  setAddedName(key: string, ingredientKey: string, event: Event): void {
    const value = inputValue(event);
    this.patchAdded(key, ingredientKey, (i) => ({
      ...i,
      names: { ...i.names, [this.editingLocale()]: value },
    }));
  }

  setAddedQuantity(key: string, ingredientKey: string, event: Event): void {
    const quantity = numberOrNull(inputValue(event)) ?? 0;
    this.patchAdded(key, ingredientKey, (i) => ({ ...i, quantity }));
  }

  setAddedUnit(key: string, ingredientKey: string, event: Event): void {
    const unit = inputValue(event) as Unit;
    this.patchAdded(key, ingredientKey, (i) => ({ ...i, unit }));
  }

  setAddedCategory(key: string, ingredientKey: string, event: Event): void {
    const pantryCategory = inputValue(event) as PantryCategory;
    this.patchAdded(key, ingredientKey, (i) => ({ ...i, pantryCategory }));
  }

  /* --------------------------------------------------------------- the summary */

  /**
   * How much of the recipe this variation actually restates.
   *
   * Counted from the same rules the payload is built from, so what the author is
   * told is what gets stored — including that an untouched override does not
   * count, because it is not saved either.
   */
  summary(v: VariationDraft): {
    changed: number;
    skipped: number;
    inserted: number;
    shared: number;
  } {
    const steps = this.effectiveStepChanges(v);
    const changed = steps.filter((s) => !s.removed).length;
    const skipped = steps.filter((s) => s.removed).length;
    return {
      changed,
      skipped,
      inserted: v.insertedSteps.filter((s) => hasText(s.texts)).length,
      shared: this.baseSteps().length - changed - skipped,
    };
  }

  /* ---------------------------------------------------------------- the payload */

  /**
   * The whole set, as differences.
   *
   * Only what the author actually touched appears: a step with no entry in
   * `stepChanges` cannot reach this, and an override still identical to the
   * shared text is dropped here rather than stored as a duplicate.
   */
  toPayload(): VariationWrite[] {
    return this.variations().map((v, index) => ({
      ...(v.id ? { id: v.id } : {}),
      sortOrder: index,
      ...(v.prepTime === null ? {} : { prepTime: v.prepTime }),
      ...(v.cookTime === null ? {} : { cookTime: v.cookTime }),
      texts: LOCALES.filter(
        (l) => (v.names[l.code] ?? '').trim() || (v.notes[l.code] ?? '').trim(),
      ).map((l) => ({
        locale: l.code,
        name: v.names[l.code] ?? '',
        note: v.notes[l.code] ?? '',
      })),
      ingredients: this.ingredientsPayload(v),
      steps: this.stepsPayload(v),
    }));
  }

  private stepsPayload(v: VariationDraft): VariationStepWrite[] {
    const overrides: VariationStepWrite[] = this.effectiveStepChanges(v).map((change) =>
      change.removed
        ? { stepId: change.stepId, removed: true }
        : {
            stepId: change.stepId,
            texts: LOCALES.filter((l) => (change.texts[l.code] ?? '').trim()).map((l) => ({
              locale: l.code,
              text: change.texts[l.code] ?? '',
            })),
          },
    );

    const inserted: VariationStepWrite[] = v.insertedSteps
      .filter((step) => hasText(step.texts))
      .map((step) => ({
        afterPosition: step.afterPosition,
        texts: LOCALES.filter((l) => (step.texts[l.code] ?? '').trim()).map((l) => ({
          locale: l.code,
          text: step.texts[l.code] ?? '',
        })),
      }));

    return [...overrides, ...inserted];
  }

  private ingredientsPayload(v: VariationDraft): VariationIngredientWrite[] {
    const changes: VariationIngredientWrite[] = [];
    for (const [ingredientId, change] of Object.entries(v.ingredientChanges)) {
      if (change.mode === 'remove') {
        changes.push({ ingredientId, removed: true });
        continue;
      }
      const base = this.baseIngredients().find((i) => i.id === ingredientId);
      // Identical to the base is not a change. Storing it would put a second
      // copy of the same quantity in the database and call it a difference.
      if (
        base &&
        change.quantity === base.quantity &&
        change.unit === base.unit &&
        change.pantryCategory === base.pantryCategory
      ) {
        continue;
      }
      changes.push({
        ingredientId,
        ...(change.quantity === null ? {} : { quantity: change.quantity }),
        ...(change.unit === null ? {} : { unit: change.unit }),
        ...(change.pantryCategory === null ? {} : { pantryCategory: change.pantryCategory }),
      });
    }

    const added: VariationIngredientWrite[] = v.addedIngredients
      .filter((ingredient) => hasText(ingredient.names))
      .map((ingredient, order) => ({
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        pantryCategory: ingredient.pantryCategory,
        sortOrder: order,
        names: LOCALES.filter((l) => (ingredient.names[l.code] ?? '').trim()).map((l) => ({
          locale: l.code,
          name: ingredient.names[l.code] ?? '',
        })),
      }));

    return [...changes, ...added];
  }

  /** The step changes that are real: a seeded override nobody edited is not one. */
  private effectiveStepChanges(
    v: VariationDraft,
  ): { stepId: string; removed: boolean; texts: ByLocale }[] {
    return Object.entries(v.stepChanges)
      .map(([stepId, change]) => ({
        stepId,
        removed: change.mode === 'skip',
        texts: change.texts,
      }))
      .filter((change) => {
        if (change.removed) return true;
        if (!hasText(change.texts)) return false;
        const shared = this.sharedTextsOf(change.stepId);
        return LOCALES.some(
          (l) => (change.texts[l.code] ?? '').trim() !== (shared[l.code] ?? '').trim(),
        );
      });
  }

  private sharedTextsOf(stepId: string): ByLocale {
    const step = this.baseSteps().find((s) => s.id === stepId);
    return byLocaleFrom(step?.texts ?? [], (t) => t.text, (t) => t.locale);
  }

  private patch(key: string, change: (v: VariationDraft) => VariationDraft): void {
    this.variations.update((list) => list.map((v) => (v.key === key ? change(v) : v)));
    this.touched.set(true);
  }

  private patchIngredient(
    key: string,
    ingredientId: string,
    change: (c: IngredientChangeDraft) => IngredientChangeDraft,
  ): void {
    this.patch(key, (v) => {
      const current = v.ingredientChanges[ingredientId];
      if (!current) return v;
      return {
        ...v,
        ingredientChanges: { ...v.ingredientChanges, [ingredientId]: change(current) },
      };
    });
  }

  private patchAdded(
    key: string,
    ingredientKey: string,
    change: (i: AddedIngredientDraft) => AddedIngredientDraft,
  ): void {
    this.patch(key, (v) => ({
      ...v,
      addedIngredients: v.addedIngredients.map((i) =>
        i.key === ingredientKey ? change(i) : i,
      ),
    }));
  }
}

function draftOf(variation: AuthoringVariation): VariationDraft {
  const stepChanges: Record<string, StepChangeDraft> = {};
  for (const step of variation.steps) {
    if (!step.stepId) continue;
    stepChanges[step.stepId] = {
      mode: step.removed ? 'skip' : 'override',
      texts: byLocaleFrom(step.texts, (t) => t.text, (t) => t.locale),
    };
  }

  const ingredientChanges: Record<string, IngredientChangeDraft> = {};
  for (const ingredient of variation.ingredients) {
    if (!ingredient.ingredientId) continue;
    ingredientChanges[ingredient.ingredientId] = {
      mode: ingredient.removed ? 'remove' : 'change',
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      pantryCategory: ingredient.pantryCategory,
    };
  }

  return {
    key: nextKey(),
    id: variation.id,
    names: byLocaleFrom(variation.texts, (t) => t.name, (t) => t.locale),
    notes: byLocaleFrom(variation.texts, (t) => t.note, (t) => t.locale),
    prepTime: variation.prepTime,
    cookTime: variation.cookTime,
    stepChanges,
    insertedSteps: variation.steps
      .filter((step) => !step.stepId)
      .map((step) => ({
        key: nextKey(),
        afterPosition: step.afterPosition ?? 0,
        texts: byLocaleFrom(step.texts, (t) => t.text, (t) => t.locale),
      })),
    ingredientChanges,
    addedIngredients: variation.ingredients
      .filter((ingredient) => !ingredient.ingredientId && !ingredient.removed)
      .map((ingredient) => ({
        key: nextKey(),
        names: byLocaleFrom(ingredient.names, (n) => n.name, (n) => n.locale),
        quantity: ingredient.quantity ?? 0,
        unit: ingredient.unit ?? Unit.G,
        pantryCategory: ingredient.pantryCategory ?? PantryCategory.OTHER,
      })),
  };
}

function textFor(texts: { locale: string; text: string }[], locale: Locale): string {
  return texts.find((t) => t.locale === locale)?.text ?? texts[0]?.text ?? '';
}

function nameFor(names: { locale: string; name: string }[], locale: Locale): string {
  return names.find((n) => n.locale === locale)?.name ?? names[0]?.name ?? '';
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
