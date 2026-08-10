import { consolidateIngredients } from './consolidation.helper';
import { Unit } from '../../shared/enums/index.js';

/**
 * One line per ingredient, not one line per unit.
 *
 * Reported as "2 list items of white onion, 2 list items of red onion — it
 * should have been 1 list item, but summarized". Consolidation keyed on
 * `name|unit`, so the same ingredient measured two ways never met: the corpus
 * has White Onion as 2 piece in one recipe and 80 g in another, and Salt as
 * tbsp, tsp, g AND pinch.
 *
 * Where the two measure the same KIND of thing they are converted and added.
 * Where they do not — grams of onion against a count of onions — no honest
 * single number exists without knowing what an onion weighs, so both survive
 * and the list groups them under one name.
 */
describe('consolidateIngredients', () => {
  const item = (name: string, quantity: number, unit: Unit) => ({
    name,
    quantity,
    unit,
  });

  it('adds up two amounts of the same thing in the same unit', () => {
    const out = consolidateIngredients([
      item('Water', 200, Unit.ML),
      item('Water', 150, Unit.ML),
    ]);

    expect(out).toEqual([{ name: 'Water', quantity: 350, unit: Unit.ML }]);
  });

  it('folds tablespoons into teaspoons rather than listing both', () => {
    // The whole point: 1 tbsp IS 3 tsp, so two rows here were never necessary.
    const out = consolidateIngredients([
      item('Ground Cumin', 1, Unit.TBSP),
      item('Ground Cumin', 1, Unit.TSP),
    ]);

    expect(out).toEqual([
      { name: 'Ground Cumin', quantity: 4, unit: Unit.TSP },
    ]);
  });

  it('measures in the smallest unit it was given, so nothing becomes a fraction', () => {
    // The distractor: converting to the FIRST unit seen turns 1 tsp into 0.33
    // tbsp, which is a worse thing to read in a shop than 4 tsp.
    const out = consolidateIngredients([
      item('Salt', 2, Unit.TBSP),
      item('Salt', 1, Unit.TSP),
    ]);

    expect(out).toEqual([{ name: 'Salt', quantity: 7, unit: Unit.TSP }]);
  });

  it('adds millilitres to litres', () => {
    const out = consolidateIngredients([
      item('Stock', 1, Unit.L),
      item('Stock', 500, Unit.ML),
    ]);

    expect(out).toEqual([{ name: 'Stock', quantity: 1500, unit: Unit.ML }]);
  });

  it('adds grams to kilos', () => {
    const out = consolidateIngredients([
      item('Flour', 1, Unit.KG),
      item('Flour', 250, Unit.G),
    ]);

    expect(out).toEqual([{ name: 'Flour', quantity: 1250, unit: Unit.G }]);
  });

  it('keeps a count and a weight apart, because no honest sum exists', () => {
    // 2 onions plus 80 g of onion is not 82 of anything. Both survive; the list
    // shows them under one name.
    const out = consolidateIngredients([
      item('White Onion', 2, Unit.PIECE),
      item('White Onion', 80, Unit.G),
    ]);

    expect(out).toHaveLength(2);
    expect(out).toContainEqual({
      name: 'White Onion',
      quantity: 2,
      unit: Unit.PIECE,
    });
    expect(out).toContainEqual({
      name: 'White Onion',
      quantity: 80,
      unit: Unit.G,
    });
  });

  it('does not convert a pinch into a measurement it is not', () => {
    // A pinch is a gesture, not a volume. Turning it into 0.2 tsp would state a
    // precision the recipe never had.
    const out = consolidateIngredients([
      item('Salt', 1, Unit.PINCH),
      item('Salt', 1, Unit.TSP),
    ]);

    expect(out).toHaveLength(2);
  });

  it('still treats the same name written two ways as one ingredient', () => {
    const out = consolidateIngredients([
      item(' Red Onion ', 1, Unit.PIECE),
      item('red onion', 2, Unit.PIECE),
    ]);

    expect(out).toEqual([{ name: 'Red Onion', quantity: 3, unit: Unit.PIECE }]);
  });

  it('rounds off the arithmetic, not the ingredient', () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004, and a shopping list
    // that says that has lost the reader's trust over nothing.
    const out = consolidateIngredients([
      item('Oil', 0.1, Unit.L),
      item('Oil', 0.2, Unit.L),
    ]);

    // Litres in, litres out: no millilitre was asked for, so introducing one
    // would be the same overreach as turning a pinch into a teaspoon.
    expect(out).toEqual([{ name: 'Oil', quantity: 0.3, unit: Unit.L }]);
  });

  it('keeps two different ingredients apart', () => {
    const out = consolidateIngredients([
      item('White Onion', 1, Unit.PIECE),
      item('Red Onion', 1, Unit.PIECE),
    ]);

    expect(out).toHaveLength(2);
  });
});
