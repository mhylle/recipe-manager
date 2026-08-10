import { planRestock } from './restock.helper';
import { Unit, PantryCategory } from '../../shared/enums/index.js';

/**
 * Putting the shopping away.
 *
 * "The pantry should be updated with items that we purchased from shopping
 * list." Until now the loop was half built: generating a list DEDUCTS what the
 * pantry already holds, but nothing ever put the shopping back, so the pantry
 * stayed frozen at what it held before the shop and the next list re-bought it.
 *
 * Pure on purpose — this decides what somebody owns, and it should be provable
 * without a database anywhere near it.
 */
describe('planRestock', () => {
  const bought = (
    name: string,
    quantity: number,
    unit: Unit,
    category?: PantryCategory,
  ) => ({ name, quantity, unit, category, checked: true });

  const held = (
    id: string,
    name: string,
    quantity: number,
    unit: Unit,
    category = PantryCategory.OTHER,
  ) => ({ id, name, quantity, unit, category });

  it('adds what was bought to what is already there', () => {
    const plan = planRestock(
      [held('p1', 'Flour', 500, Unit.G)],
      [bought('Flour', 1000, Unit.G)],
    );

    expect(plan.updates).toEqual([{ id: 'p1', quantity: 1500 }]);
    expect(plan.creates).toEqual([]);
  });

  it('converts before adding, so a kilo lands on top of the grams', () => {
    const plan = planRestock(
      [held('p1', 'Flour', 500, Unit.G)],
      [bought('Flour', 1, Unit.KG)],
    );

    // Kept in the unit the pantry already used: the shelf does not reorganise
    // itself because of one shop.
    expect(plan.updates).toEqual([{ id: 'p1', quantity: 1500 }]);
  });

  it('starts a new pantry entry for something never held before', () => {
    const plan = planRestock(
      [],
      [bought('Star Anise', 20, Unit.G, PantryCategory.SPICES)],
    );

    expect(plan.creates).toEqual([
      {
        name: 'Star Anise',
        quantity: 20,
        unit: Unit.G,
        category: PantryCategory.SPICES,
      },
    ]);
  });

  it('files an item of unknown origin under other rather than guessing', () => {
    // Lists written before the category column existed carry none, and there is
    // nothing to infer it from.
    const plan = planRestock([], [bought('Mystery', 1, Unit.PIECE)]);

    expect(plan.creates[0].category).toBe(PantryCategory.OTHER);
  });

  it('leaves behind whatever was not ticked off', () => {
    // The whole contract: an unchecked line was not bought. Stocking it would
    // tell the kitchen it owns something nobody put in the trolley.
    const plan = planRestock(
      [held('p1', 'Flour', 500, Unit.G)],
      [
        { name: 'Flour', quantity: 1000, unit: Unit.G, checked: false },
        bought('Sugar', 500, Unit.G),
      ],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.creates.map((c) => c.name)).toEqual(['Sugar']);
  });

  it('matches the pantry however the two were capitalised', () => {
    const plan = planRestock(
      [held('p1', 'Plain Flour', 500, Unit.G)],
      [bought('  plain flour ', 250, Unit.G)],
    );

    expect(plan.updates).toEqual([{ id: 'p1', quantity: 750 }]);
  });

  it('starts a separate entry when the amounts cannot be added', () => {
    // Two onions is not 80 g of onion, and no honest sum exists. Guessing a
    // weight to merge them would put a number nobody measured on the shelf.
    const plan = planRestock(
      [held('p1', 'White Onion', 80, Unit.G, PantryCategory.PRODUCE)],
      [bought('White Onion', 2, Unit.PIECE, PantryCategory.PRODUCE)],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.creates).toEqual([
      {
        name: 'White Onion',
        quantity: 2,
        unit: Unit.PIECE,
        category: PantryCategory.PRODUCE,
      },
    ]);
  });

  it('adds two lines of the same thing to the same shelf entry', () => {
    // #79 leaves at most one row per KIND, but a list can still carry both — and
    // stocking must not pick one and drop the other.
    const plan = planRestock(
      [held('p1', 'Salt', 100, Unit.G)],
      [bought('Salt', 50, Unit.G), bought('Salt', 1, Unit.KG)],
    );

    expect(plan.updates).toEqual([{ id: 'p1', quantity: 1150 }]);
  });

  it('rounds the arithmetic, not the shopping', () => {
    const plan = planRestock(
      [held('p1', 'Oil', 0.1, Unit.L)],
      [bought('Oil', 0.2, Unit.L)],
    );

    expect(plan.updates).toEqual([{ id: 'p1', quantity: 0.3 }]);
  });

  it('does nothing at all with an empty list', () => {
    expect(planRestock([held('p1', 'Flour', 500, Unit.G)], [])).toEqual({
      updates: [],
      creates: [],
    });
  });
});
