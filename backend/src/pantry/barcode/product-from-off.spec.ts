import { productFrom } from './product-from-off';
import { PantryCategory, Unit } from '../../shared/enums/index.js';

/**
 * Turning what Open Food Facts knows into something a pantry can hold.
 *
 * Pure, because it is the part with all the judgement in it: an open database
 * written by the public has missing names, empty quantities, categories in four
 * languages and packaging sizes no unit of ours can express. Every one of those
 * has to become either a sensible pantry item or an honest nothing — never a
 * guess dressed as a fact.
 */
describe('productFrom', () => {
  const off = (over: Record<string, unknown> = {}) => ({
    product_name: 'Nutella',
    brands: 'Ferrero',
    categories_tags: ['en:spreads', 'en:sweet-spreads'],
    quantity: '400 g',
    ...over,
  });

  it('reads the name, the shelf and the size off a known product', () => {
    const product = productFrom('3017620422003', off());

    expect(product).toEqual({
      barcode: '3017620422003',
      name: 'Nutella',
      category: PantryCategory.CONDIMENTS,
      quantity: 400,
      unit: Unit.G,
    });
  });

  it('is nothing at all when the database has no name for it', () => {
    // A pantry row called "" helps nobody. Better to hand back nothing and let
    // the cook type what it is. Nothing to fall back to either: no product name,
    // no generic name, no brand.
    expect(
      productFrom(
        '123',
        off({ product_name: '', generic_name: '', brands: '' }),
      ),
    ).toBeNull();
  });

  it('falls back to the brand when that is all there is', () => {
    const product = productFrom(
      '123',
      off({ product_name: '', brands: 'Cocio' }),
    );

    expect(product?.name).toBe('Cocio');
  });

  it('takes only the first brand, not the whole list', () => {
    // OFF concatenates them: "Nutella, Ferrero, Yum yum" is one string.
    const product = productFrom(
      '123',
      off({ product_name: '', brands: 'Nutella, Ferrero, Yum yum' }),
    );

    expect(product?.name).toBe('Nutella');
  });

  it('leaves the amount empty rather than inventing one', () => {
    // The distractor: defaulting to 1 piece looks harmless and quietly tells
    // the kitchen it owns one of something it has not measured.
    const product = productFrom('123', off({ quantity: '' }));

    expect(product?.quantity).toBeNull();
    expect(product?.unit).toBeNull();
  });

  it('reads a decimal written the Danish way', () => {
    const product = productFrom('123', off({ quantity: '1,5 l' }));

    expect(product).toMatchObject({ quantity: 1.5, unit: Unit.L });
  });

  it('ignores a packaging size it cannot express', () => {
    // 6 x 33 cl is a real answer to the wrong question, and centilitres are not
    // one of our units.
    const product = productFrom('123', off({ quantity: '6 x 33 cl' }));

    expect(product?.quantity).toBeNull();
  });

  describe('which shelf it goes on', () => {
    const shelfFor = (tags: string[]) =>
      productFrom('123', off({ categories_tags: tags }))?.category;

    it('puts milk and cheese with the dairy', () => {
      expect(shelfFor(['en:dairies', 'en:cheeses'])).toBe(PantryCategory.DAIRY);
    });

    it('puts juice and coffee with the drinks', () => {
      expect(shelfFor(['en:beverages', 'en:juices'])).toBe(
        PantryCategory.BEVERAGES,
      );
    });

    it('puts frozen things in the freezer, whatever else they are', () => {
      // Frozen peas are vegetables AND frozen, and the freezer is where they
      // are, so it wins.
      expect(shelfFor(['en:vegetables', 'en:frozen-foods'])).toBe(
        PantryCategory.FROZEN,
      );
    });

    it('falls back to other rather than guessing from a name it does not know', () => {
      expect(shelfFor(['en:some-category-nobody-mapped'])).toBe(
        PantryCategory.OTHER,
      );
    });

    it('copes with a product filed under nothing at all', () => {
      expect(
        productFrom('123', off({ categories_tags: undefined }))?.category,
      ).toBe(PantryCategory.OTHER);
    });

    it('is not fooled by the umbrella tag that sits on half the database', () => {
      // Caught on production, not here: these are the REAL tags Open Food Facts
      // returns for Arla Smørbar, a Danish butter. `plant-based-foods-and-
      // beverages` is a taxonomy root, and matched as a substring it contains
      // "beverages" — so the butter came back filed as a drink.
      expect(
        shelfFor([
          'en:plant-based-foods-and-beverages',
          'en:dairies',
          'en:plant-based-foods',
          'en:fats',
          'en:spreads',
          'en:spreadable-fats',
          'en:dairy-spreads',
          'en:milkfat',
          'en:butters',
        ]),
      ).toBe(PantryCategory.DAIRY);
    });

    it('reads the English tag even when the list is mostly French', () => {
      // OFF mixes languages in one array. Only the `en:` ones are stable.
      expect(
        shelfFor(['fr:produits-laitiers', 'en:dairies', 'fr:fromages']),
      ).toBe(PantryCategory.DAIRY);
    });
  });
});
