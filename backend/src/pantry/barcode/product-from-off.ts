import { PantryCategory, Unit } from '../../shared/enums/index.js';

/** The fields we read off an Open Food Facts product. Everything is optional there. */
export interface OffProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories_tags?: string[];
  quantity?: string;
}

/** A scanned product, in the shape the pantry form wants to be filled with. */
export interface ScannedProduct {
  barcode: string;
  name: string;
  category: PantryCategory;
  /** Null when the packaging size is missing or in a unit we do not keep. */
  quantity: number | null;
  unit: Unit | null;
}

/**
 * Which shelf an Open Food Facts category belongs on.
 *
 * Ordered, and the order is the rule: a bag of frozen peas is tagged both
 * `vegetables` and `frozen-foods`, and the freezer is where it actually IS. So
 * the more specific location wins over what the food is made of.
 *
 * Matched as substrings against the `en:` tags only. OFF mixes languages in one
 * array — `fr:produits-laitiers` sits beside `en:dairies` — and only the English
 * ones are stable enough to key on.
 */
const SHELVES: readonly [PantryCategory, readonly string[]][] = [
  [PantryCategory.FROZEN, ['frozen']],
  [
    PantryCategory.BEVERAGES,
    [
      'beverage',
      'drink',
      'juice',
      'water',
      'coffee',
      'tea',
      'soda',
      'wine',
      'beer',
    ],
  ],
  [
    PantryCategory.DAIRY,
    [
      'dairy',
      'dairies',
      'milk',
      'cheese',
      'yogurt',
      'yoghurt',
      'butter',
      'cream',
    ],
  ],
  [
    PantryCategory.MEAT,
    [
      'meat',
      'poultry',
      'chicken',
      'beef',
      'pork',
      'sausage',
      'fish',
      'seafood',
      'ham',
    ],
  ],
  [PantryCategory.PRODUCE, ['fruit', 'vegetable', 'salad', 'herbs-fresh']],
  [PantryCategory.CANNED, ['canned', 'tinned', 'preserve']],
  [
    PantryCategory.SNACKS,
    [
      'snack',
      'crisp',
      'chips',
      'biscuit',
      'candy',
      'confectionery',
      'chocolate',
      'sweet-snack',
    ],
  ],
  [PantryCategory.BAKING, ['flour', 'sugar', 'baking', 'yeast']],
  [PantryCategory.SPICES, ['spice', 'seasoning', 'herb', 'salt', 'pepper']],
  [
    PantryCategory.CONDIMENTS,
    [
      'sauce',
      'spread',
      'condiment',
      'oil',
      'vinegar',
      'mustard',
      'ketchup',
      'mayonnaise',
    ],
  ],
  [
    PantryCategory.GRAINS,
    ['pasta', 'rice', 'bread', 'cereal', 'grain', 'noodle'],
  ],
];

/**
 * Tags that say nothing about which shelf something goes on.
 *
 * `plant-based-foods-and-beverages` is an OFF taxonomy ROOT — it sits on a
 * staggering share of the database and means little more than "food". Matched
 * as a substring it contains the word "beverages", which is how Danish butter
 * came back from production filed as a drink.
 */
const UMBRELLA_TAGS: ReadonlySet<string> = new Set([
  'plant-based-foods-and-beverages',
  'plant-based-foods',
  'foods',
  'groceries',
]);

/** The packaging sizes we can actually keep, spelled as OFF spells them. */
const UNITS: readonly [string, Unit][] = [
  ['kg', Unit.KG],
  ['g', Unit.G],
  ['ml', Unit.ML],
  ['l', Unit.L],
];

/**
 * What Open Food Facts knows, as something a pantry can hold — or nothing.
 *
 * Nothing is a real answer here and is used deliberately. An open database
 * written by the public has products with no name, no size, and categories in
 * four languages; a row called "" with a quantity of 1 helps nobody and quietly
 * tells the kitchen it owns something nobody measured. Where this cannot say,
 * it says so, and the cook fills the gap.
 */
export function productFrom(
  barcode: string,
  product: OffProduct,
): ScannedProduct | null {
  const name = nameOf(product);
  if (!name) {
    return null;
  }

  const size = sizeOf(product.quantity);

  return {
    barcode,
    name,
    category: shelfOf(product.categories_tags ?? []),
    quantity: size?.quantity ?? null,
    unit: size?.unit ?? null,
  };
}

function nameOf(product: OffProduct): string {
  const named = product.product_name?.trim() || product.generic_name?.trim();
  if (named) {
    return named;
  }
  // Brands arrive concatenated — "Nutella, Ferrero, Yum yum" is one string —
  // and the first is the one a person would say.
  return product.brands?.split(',')[0]?.trim() ?? '';
}

function shelfOf(tags: string[]): PantryCategory {
  const english = tags
    .filter((tag) => tag.startsWith('en:'))
    .map((tag) => tag.slice(3).toLowerCase())
    .filter((tag) => !UMBRELLA_TAGS.has(tag));

  for (const [category, keywords] of SHELVES) {
    if (english.some((tag) => keywords.some((word) => tag.includes(word)))) {
      return category;
    }
  }
  return PantryCategory.OTHER;
}

/**
 * "400 g" or "1,5 l" as a number and a unit.
 *
 * Null for anything else, including the perfectly real "6 x 33 cl": it is an
 * answer to a different question, and centilitres are not a unit this app keeps.
 */
function sizeOf(
  quantity: string | undefined,
): { quantity: number; unit: Unit } | null {
  const text = quantity?.trim().toLowerCase();
  if (!text) {
    return null;
  }

  // Anchored at both ends on purpose: a loose match would read "6 x 33 cl" as
  // 6 of something and file a case of beer as six litres.
  const match = /^([0-9]+(?:[.,][0-9]+)?)\s*([a-z]+)$/.exec(text);
  if (!match) {
    return null;
  }

  const unit = UNITS.find(([spelling]) => spelling === match[2]);
  if (!unit) {
    return null;
  }

  return { quantity: Number(match[1].replace(',', '.')), unit: unit[1] };
}
