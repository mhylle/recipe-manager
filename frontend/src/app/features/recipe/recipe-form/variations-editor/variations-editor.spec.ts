import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { VariationsEditorComponent } from './variations-editor';
import { Unit } from '../../../../shared/enums/unit.enum';
import { PantryCategory } from '../../../../shared/enums/pantry-category.enum';
import type { RecipeVariationsAuthoring } from '../../../../shared/models/variation-authoring.model';

/**
 * The ciabatta, in the shape that makes this component hard: eighteen steps, of
 * which one variation changes two. Everything here is about the other sixteen.
 */
const CIABATTA: RecipeVariationsAuthoring = {
  baseIngredients: [
    {
      id: 'i-yeast',
      quantity: 1,
      unit: Unit.G,
      pantryCategory: PantryCategory.BAKING,
      names: [
        { locale: 'en', name: 'Fresh Yeast' },
        { locale: 'da', name: 'Frisk gær' },
      ],
    },
    {
      id: 'i-water',
      quantity: 350,
      unit: Unit.ML,
      pantryCategory: PantryCategory.OTHER,
      names: [
        { locale: 'en', name: 'Water' },
        { locale: 'da', name: 'Vand' },
      ],
    },
  ],
  baseSteps: Array.from({ length: 18 }, (_, index) => ({
    id: `s${index}`,
    texts: [
      { locale: 'en', text: `Step ${index + 1} as written` },
      { locale: 'da', text: `Trin ${index + 1} som skrevet` },
    ],
  })),
  variations: [
    {
      id: 'v-10g',
      sortOrder: 0,
      prepTime: 180,
      cookTime: null,
      texts: [
        { locale: 'en', name: '10 g yeast — same day', note: 'The quickest.' },
        { locale: 'da', name: '10 g gær — samme dag', note: 'Den hurtigste.' },
      ],
      ingredients: [
        {
          ingredientId: 'i-yeast',
          removed: false,
          quantity: 10,
          unit: null,
          pantryCategory: null,
          sortOrder: 0,
          names: [],
        },
        {
          ingredientId: null,
          removed: false,
          quantity: 8,
          unit: Unit.G,
          pantryCategory: PantryCategory.BAKING,
          sortOrder: 1,
          names: [
            { locale: 'en', name: 'Sugar' },
            { locale: 'da', name: 'Sukker' },
          ],
        },
      ],
      // Two of eighteen. The other sixteen are shared, and stay that way.
      steps: [
        {
          stepId: 's6',
          removed: false,
          afterPosition: null,
          texts: [{ locale: 'en', text: 'Stir the sugar in too' }],
        },
        {
          stepId: 's10',
          removed: false,
          afterPosition: null,
          texts: [{ locale: 'en', text: 'Two hours is enough' }],
        },
      ],
    },
  ],
};

describe('VariationsEditorComponent', () => {
  let fixture: ComponentFixture<VariationsEditorComponent>;
  let component: VariationsEditorComponent;

  const load = (authoring: RecipeVariationsAuthoring | null = CIABATTA): void => {
    fixture.componentRef.setInput('authoring', authoring);
    fixture.detectChanges();
  };

  const expand = (): void => {
    component.toggle(component.variations()[0].key);
    fixture.detectChanges();
  };

  const firstKey = (): string => component.variations()[0].key;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VariationsEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VariationsEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('authoring', null);
    fixture.componentRef.setInput('editingLocale', 'en');
    fixture.detectChanges();
  });

  describe('the sixteen steps nobody changed', () => {
    it('saves two step overrides for a variation that changes two of eighteen', () => {
      // THE constraint. A panel that offered all eighteen as text would get all
      // eighteen filled in, and the duplication the schema exists to prevent
      // would come back through the UI.
      load();

      const [variation] = component.toPayload();

      expect(variation.steps).toHaveLength(2);
      expect(variation.steps?.map((s) => s.stepId).sort()).toEqual(['s10', 's6']);
    });

    it('renders no editable step control until one is asked for', () => {
      // The structural half of the same guarantee: a shared step is static text
      // with a button beside it, so there is nowhere to type by accident.
      // Two overrides are loaded, so two textareas — not eighteen.
      load();
      expand();

      const stepBoxes: NodeListOf<HTMLTextAreaElement> =
        fixture.nativeElement.querySelectorAll('.step textarea');

      expect(stepBoxes).toHaveLength(2);
    });

    it('leaves a step shared when the author opens it and changes nothing', () => {
      // "Change" seeds the box with the shared text so it can be edited rather
      // than retyped. Saving that untouched would store a second copy of the
      // recipe's own words and call it a difference.
      load();
      component.overrideStep(firstKey(), 's2');

      const [variation] = component.toPayload();

      expect(variation.steps?.map((s) => s.stepId)).not.toContain('s2');
      expect(variation.steps).toHaveLength(2);
    });

    it('counts what it will actually save, not what is open', () => {
      load();
      component.overrideStep(firstKey(), 's2');

      const summary = component.summary(component.variations()[0]);

      expect(summary.changed).toBe(2);
      expect(summary.shared).toBe(16);
    });
  });

  describe('changing the method', () => {
    it('saves an edited override against the step it belongs to', () => {
      load();
      component.setStepText(firstKey(), 's2', inputEvent('Do it differently'));

      const [variation] = component.toPayload();
      const changed = variation.steps?.find((s) => s.stepId === 's2');

      expect(changed?.texts).toEqual([{ locale: 'en', text: 'Do it differently' }]);
    });

    it('saves a skipped step as removed rather than as empty text', () => {
      // Empty text is not the same fact: applying it would leave the step in
      // the method with nothing written in it.
      load();
      component.skipStep(firstKey(), 's3');

      const [variation] = component.toPayload();

      expect(variation.steps).toContainEqual({ stepId: 's3', removed: true });
    });

    it('puts a skipped step back by storing nothing at all', () => {
      load();
      component.skipStep(firstKey(), 's3');
      component.shareStep(firstKey(), 's3');

      const [variation] = component.toPayload();

      expect(variation.steps?.map((s) => s.stepId)).not.toContain('s3');
    });

    it('saves an inserted step by position, with no step to point at', () => {
      // The marinade goes first, and there is no base step it replaces.
      load();
      component.insertStep(firstKey(), 0);
      const inserted = component.variations()[0].insertedSteps[0];
      component.setInsertedStepText(firstKey(), inserted.key, inputEvent('Marinate overnight'));

      const [variation] = component.toPayload();
      const added = variation.steps?.find((s) => !s.stepId);

      expect(added).toEqual({
        afterPosition: 0,
        texts: [{ locale: 'en', text: 'Marinate overnight' }],
      });
    });

    it('drops an inserted step nobody wrote anything in', () => {
      load();
      component.insertStep(firstKey(), 3);

      const [variation] = component.toPayload();

      expect(variation.steps?.filter((s) => !s.stepId)).toHaveLength(0);
    });
  });

  describe('changing the shopping', () => {
    it('saves a quantity change against the base ingredient', () => {
      load();

      const [variation] = component.toPayload();

      expect(variation.ingredients).toContainEqual({
        ingredientId: 'i-yeast',
        quantity: 10,
      });
    });

    it('leaves an ingredient alone when the author opens it and changes nothing', () => {
      load();
      component.changeIngredient(firstKey(), CIABATTA.baseIngredients[1]);

      const [variation] = component.toPayload();

      expect(variation.ingredients?.map((i) => i.ingredientId)).not.toContain('i-water');
    });

    it('saves an added ingredient with its names and no base to point at', () => {
      load();

      const [variation] = component.toPayload();
      const sugar = variation.ingredients?.find((i) => !i.ingredientId);

      expect(sugar).toMatchObject({
        quantity: 8,
        unit: Unit.G,
        pantryCategory: PantryCategory.BAKING,
        names: [
          { locale: 'en', name: 'Sugar' },
          { locale: 'da', name: 'Sukker' },
        ],
      });
    });

    it('saves a dropped ingredient as removed', () => {
      load();
      component.dropIngredient(firstKey(), 'i-water');

      const [variation] = component.toPayload();

      expect(variation.ingredients).toContainEqual({
        ingredientId: 'i-water',
        removed: true,
      });
    });

    it('drops an added ingredient nobody named', () => {
      // Without a name it is a row in the shopping list saying nothing.
      load();
      component.addIngredient(firstKey());

      const [variation] = component.toPayload();

      expect(variation.ingredients?.filter((i) => !i.ingredientId)).toHaveLength(1);
    });
  });

  describe('the round trip', () => {
    it('gives back the variation it was given, id and all', () => {
      // The ciabatta's four are real, live, and were authored over the API. The
      // form has to be able to open them and put them back unchanged.
      load();

      const [variation] = component.toPayload();

      expect(variation.id).toBe('v-10g');
      expect(variation.prepTime).toBe(180);
      expect(variation.texts).toEqual([
        { locale: 'en', name: '10 g yeast — same day', note: 'The quickest.' },
        { locale: 'da', name: '10 g gær — samme dag', note: 'Den hurtigste.' },
      ]);
    });

    it('inherits the recipe’s time rather than pinning it, when none is given', () => {
      // Null and zero are different: a variation may legitimately take no time.
      load();

      const [variation] = component.toPayload();

      expect(variation.cookTime).toBeUndefined();
    });

    it('has touched nothing until somebody does', () => {
      // The parent only sends variations when this is true, so a save that came
      // to fix a typo cannot rewrite them.
      load();

      expect(component.touched()).toBe(false);

      component.skipStep(firstKey(), 's1');

      expect(component.touched()).toBe(true);
    });

    it('adds a variation with no id, so the server creates one', () => {
      load();
      component.addVariation();
      const added = component.variations()[1];
      component.setName(added.key, inputEvent('Overnight'));

      const written = component.toPayload()[1];

      expect(written.id).toBeUndefined();
      expect(written.texts).toEqual([{ locale: 'en', name: 'Overnight', note: '' }]);
    });
  });

  describe('both languages', () => {
    it('writes the language the form is on, keeping the other', () => {
      // The editing language is the form's tab, not the UI language. Writing
      // Danish must not blank the English already stored.
      load();
      fixture.componentRef.setInput('editingLocale', 'da');
      fixture.detectChanges();

      component.setName(firstKey(), inputEvent('10 g gær — rettet'));

      const [variation] = component.toPayload();

      expect(variation.texts).toContainEqual({
        locale: 'en',
        name: '10 g yeast — same day',
        note: 'The quickest.',
      });
      expect(variation.texts).toContainEqual({
        locale: 'da',
        name: '10 g gær — rettet',
        note: 'Den hurtigste.',
      });
    });

    it('shows the shared step text in the language being written', () => {
      load();
      fixture.componentRef.setInput('editingLocale', 'da');
      fixture.detectChanges();

      expect(component.sharedStepText('s4')).toBe('Trin 5 som skrevet');
    });

    it('overrides one language without touching the other', () => {
      // A step overridden only in Danish reads Danish from the variation and
      // English from the recipe — which is why the text is stored per language.
      load();
      fixture.componentRef.setInput('editingLocale', 'da');
      fixture.detectChanges();

      component.setStepText(firstKey(), 's6', inputEvent('Rør også sukkeret i'));

      const [variation] = component.toPayload();
      const step = variation.steps?.find((s) => s.stepId === 's6');

      expect(step?.texts).toEqual([
        { locale: 'en', text: 'Stir the sugar in too' },
        { locale: 'da', text: 'Rør også sukkeret i' },
      ]);
    });
  });

  it('refuses to save a variation nobody can tell apart', () => {
    load();
    component.addVariation();

    expect(component.hasNamelessVariation()).toBe(true);
  });

  it('starts empty when the recipe has no variations', () => {
    load({ ...CIABATTA, variations: [] });

    expect(component.variations()).toEqual([]);
    expect(component.toPayload()).toEqual([]);
  });
});

function inputEvent(value: string): Event {
  const input = document.createElement('input');
  input.value = value;
  const event = new Event('input');
  Object.defineProperty(event, 'target', { value: input });
  return event;
}
