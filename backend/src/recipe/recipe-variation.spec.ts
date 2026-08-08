import {
  applyVariation,
  type BaseIngredient,
  type BaseStep,
  type ResolvedVariation,
} from './recipe-variation';
import { Unit, PantryCategory } from '../shared/enums/index.js';

/**
 * The two recipes the reports were written about, cooked their other way.
 *
 * #78's ciabatta covaries four things at once — yeast, sugar, water temperature
 * and rise time — and #77's salmon changes the method rather than the numbers.
 * Both are here because a model that serves only one of them is the wrong model.
 */
describe('applyVariation', () => {
  const ing = (
    id: string,
    name: string,
    quantity: number,
    unit: Unit = Unit.G,
  ): BaseIngredient => ({
    id,
    name,
    quantity,
    unit,
    pantryCategory: PantryCategory.BAKING,
  });

  const step = (
    id: string,
    text: string,
    imageUrl: string | null = null,
  ): BaseStep => ({
    id,
    text,
    imageUrl,
  });

  const variation = (
    over: Partial<ResolvedVariation> = {},
  ): ResolvedVariation => ({
    id: 'v1',
    name: 'A variation',
    note: '',
    prepTime: null,
    cookTime: null,
    ingredients: [],
    steps: [],
    ...over,
  });

  const ciabatta = {
    ingredients: [
      ing('i-yeast', 'Fresh Yeast', 1),
      ing('i-water', 'Water', 350, Unit.ML),
      ing('i-salt', 'Salt', 8),
      ing('i-flour', 'Plain Flour', 400),
    ],
    steps: [
      step('s0', 'Stir the yeast, water and salt together.', '/img/0.webp'),
      step('s1', 'Add the flour and stir for about 20 seconds.', '/img/1.webp'),
      step('s2', 'Cover the bowl.'),
      step('s3', 'Leave to rise until doubled in size.'),
      step('s4', 'Bake at 250°C for about 18 minutes.', '/img/4.webp'),
    ],
    prepTime: 740,
    cookTime: 18,
  };

  describe('the ciabatta, at 10 g of yeast', () => {
    // Four things move together, which is why this is one variation and not
    // four separate switches the cook has to keep consistent.
    const sameDay = variation({
      name: '10 g yeast — same day',
      note: 'Two to four hours, and the water wants to be 30-35°C.',
      prepTime: 180,
      ingredients: [
        {
          ingredientId: 'i-yeast',
          removed: false,
          name: null,
          quantity: 10,
          unit: null,
          pantryCategory: null,
          sortOrder: 0,
        },
        {
          ingredientId: null,
          removed: false,
          name: 'Sugar',
          quantity: 8,
          unit: Unit.G,
          pantryCategory: PantryCategory.BAKING,
          sortOrder: 0,
        },
      ],
      steps: [
        {
          stepId: 's0',
          removed: false,
          text: 'Stir the yeast, water, salt and sugar together. Water at 30-35°C.',
          afterPosition: null,
        },
        {
          stepId: 's3',
          removed: false,
          text: 'Leave to rise until doubled — 2 to 4 hours.',
          afterPosition: null,
        },
      ],
    });

    it('changes the quantity without disturbing the rest of the ingredient', () => {
      const { ingredients } = applyVariation(ciabatta, sameDay);
      const yeast = ingredients.find((i) => i.id === 'i-yeast');

      expect(yeast).toMatchObject({
        name: 'Fresh Yeast',
        quantity: 10,
        unit: Unit.G,
      });
    });

    it('adds the sugar the base recipe does not have', () => {
      // The whole shopping-list complaint: plan this and you must buy sugar.
      const { ingredients } = applyVariation(ciabatta, sameDay);

      expect(
        ingredients.map((i) => `${i.quantity}${i.unit} ${i.name}`),
      ).toEqual([
        '10g Fresh Yeast',
        '350ml Water',
        '8g Salt',
        '400g Plain Flour',
        '8g Sugar',
      ]);
    });

    it('rewrites only the steps that differ, and keeps their photographs', () => {
      const { steps } = applyVariation(ciabatta, sameDay);

      expect(steps.map((s) => s.text)).toEqual([
        'Stir the yeast, water, salt and sugar together. Water at 30-35°C.',
        'Add the flour and stir for about 20 seconds.',
        'Cover the bowl.',
        'Leave to rise until doubled — 2 to 4 hours.',
        'Bake at 250°C for about 18 minutes.',
      ]);
      // The same pot at the same moment, described differently.
      expect(steps[0].imageUrl).toBe('/img/0.webp');
      // Untouched steps are the SAME objects' content, not copies that can drift.
      expect(steps[4].text).toBe(ciabatta.steps[4].text);
    });

    it('takes the variation’s rise time and inherits the bake', () => {
      const varied = applyVariation(ciabatta, sameDay);

      expect(varied.prepTime).toBe(180);
      expect(varied.cookTime).toBe(18);
    });
  });

  describe('the salmon, marinated overnight', () => {
    const salmon = {
      ingredients: [ing('i-salmon', 'Salmon Fillets', 4, Unit.PIECE)],
      steps: [
        step('s0', 'Combine soy, mirin, sake and sugar. Simmer 5 minutes.'),
        step('s1', 'Pat the salmon dry and season lightly.'),
        step('s2', 'Sear skin-side up for 3 minutes.'),
      ],
      prepTime: 5,
      cookTime: 15,
    };

    const overnight = variation({
      name: 'Marinated overnight',
      note: 'Garlic and soy overnight makes it taste of more than its glaze.',
      prepTime: 730,
      ingredients: [
        {
          ingredientId: null,
          removed: false,
          name: 'Garlic',
          quantity: 2,
          unit: Unit.PIECE,
          pantryCategory: PantryCategory.PRODUCE,
          sortOrder: 0,
        },
      ],
      steps: [
        {
          stepId: null,
          removed: false,
          text: 'The night before: rub the salmon with crushed garlic and soy, and refrigerate.',
          afterPosition: 0,
        },
      ],
    });

    it('puts the marinade before everything else', () => {
      const { steps } = applyVariation(salmon, overnight);

      expect(steps[0].text).toContain('The night before');
      expect(steps).toHaveLength(4);
    });

    it('drops a step the method does without', () => {
      const noSear = variation({
        steps: [
          { stepId: 's2', removed: true, text: null, afterPosition: null },
        ],
      });

      const { steps } = applyVariation(salmon, noSear);

      expect(steps.map((s) => s.id)).toEqual(['s0', 's1']);
    });

    it('keeps an insertion in place even when a step before it is removed', () => {
      // afterPosition counts BASE steps. Counting the surviving ones instead
      // would slide the marinade later the moment a variation also removed
      // something — silently, and only for that variation.
      const both = variation({
        steps: [
          { stepId: 's0', removed: true, text: null, afterPosition: null },
          {
            stepId: null,
            removed: false,
            text: 'Marinate overnight.',
            afterPosition: 0,
          },
        ],
      });

      const { steps } = applyVariation(salmon, both);

      expect(steps.map((s) => s.text)).toEqual([
        'Marinate overnight.',
        'Pat the salmon dry and season lightly.',
        'Sear skin-side up for 3 minutes.',
      ]);
    });
  });

  it('is the recipe itself when no variation is chosen', () => {
    expect(applyVariation(ciabatta, null)).toBe(ciabatta);
  });

  it('does not mutate the recipe it was given', () => {
    // Every read of a recipe with variations resolves from the same base. One
    // in-place edit and the next reader gets somebody else's variation.
    const before = JSON.stringify(ciabatta);

    applyVariation(
      ciabatta,
      variation({
        prepTime: 1,
        steps: [
          { stepId: 's0', removed: true, text: null, afterPosition: null },
        ],
      }),
    );

    expect(JSON.stringify(ciabatta)).toBe(before);
  });
});
