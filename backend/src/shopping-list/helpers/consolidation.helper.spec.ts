import { consolidateIngredients } from './consolidation.helper';
import { Unit } from '../../shared/enums/unit.enum';

describe('consolidateIngredients', () => {
  it('should merge same-name same-unit items', () => {
    const items = [
      { name: 'Flour', quantity: 200, unit: Unit.G },
      { name: 'Flour', quantity: 300, unit: Unit.G },
    ];

    const result = consolidateIngredients(items);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Flour');
    expect(result[0].quantity).toBe(500);
  });

  it('should be case-insensitive for name matching', () => {
    const items = [
      { name: 'flour', quantity: 200, unit: Unit.G },
      { name: 'Flour', quantity: 300, unit: Unit.G },
    ];

    const result = consolidateIngredients(items);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(500);
  });

  it('should not merge different units', () => {
    const items = [
      { name: 'Milk', quantity: 500, unit: Unit.ML },
      { name: 'Milk', quantity: 1, unit: Unit.L },
    ];

    const result = consolidateIngredients(items);
    expect(result).toHaveLength(2);
  });

  it('should handle empty list', () => {
    expect(consolidateIngredients([])).toHaveLength(0);
  });

  it('should trim whitespace from names', () => {
    const items = [
      { name: ' Flour ', quantity: 200, unit: Unit.G },
      { name: 'Flour', quantity: 100, unit: Unit.G },
    ];

    const result = consolidateIngredients(items);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(300);
  });
});
