import { cuisineOf, isDrink } from '../recipe/recipe-tags.js';

export interface HeroImageRecipe {
  name: string;
  description: string;
  tags: string[];
  ingredients: Array<{ name: string }>;
}

const MAX_NAMED_INGREDIENTS = 5;

/** The prompt for a recipe's hero image: a glass for a drink, a plate for food. */
export function heroImagePrompt(recipe: HeroImageRecipe): string {
  const ingredientNames = recipe.ingredients
    .slice(0, MAX_NAMED_INGREDIENTS)
    .map((i) => i.name)
    .join(', ');

  if (isDrink(recipe.tags)) {
    return (
      `Professional cocktail photography of ${recipe.name}. ${recipe.description}. ` +
      `Made with: ${ingredientNames}. ` +
      `The drink served in a ${glassFor(recipe.tags, recipe.ingredients)} with its garnish, on a home bar counter, ` +
      `condensation on the glass, soft moody lighting, shallow depth of field, ` +
      `vibrant colors. Photorealistic, no text or watermarks.`
    );
  }

  const cuisine = cuisineOf(recipe.tags);
  return (
    `Professional food photography of ${recipe.name}. ${recipe.description}. ` +
    `Key ingredients visible: ${ingredientNames}. ` +
    (cuisine
      ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine style. `
      : '') +
    `Shot from above at 45 degrees, natural warm lighting, beautiful plating on a rustic wooden table, ` +
    `shallow depth of field, appetizing and vibrant colors. High-end restaurant presentation. ` +
    `Photorealistic, no text or watermarks.`
  );
}

/** A drink's glass is chosen here, so every image of it can show the same one. */
const TROPICAL_WORDS = ['pineapple', 'coconut', 'frozen', 'tiki', 'tropical'];
const COUPE_WORDS = ['sour', 'martini', 'daiquiri', 'cosmopolitan'];

export type GlassName = 'hurricane glass' | 'coupe glass' | 'rocks glass';

/**
 * The one glass a drink is shown in.
 *
 * Decided from the recipe, not left to the image model: asked fresh for every
 * frame it picked a tulip, a tumbler, a jug, a straight glass and a copper mug
 * for the same cocktail.
 */
export function glassFor(
  tags: readonly string[],
  ingredients: ReadonlyArray<{ name: string }>,
): GlassName {
  const words = [...tags, ...ingredients.map((i) => i.name)].map((w) =>
    w.toLowerCase(),
  );
  const mentions = (needles: string[]): boolean =>
    words.some((word) => needles.some((needle) => word.includes(needle)));

  if (mentions(TROPICAL_WORDS)) return 'hurricane glass';
  if (mentions(COUPE_WORDS)) return 'coupe glass';
  return 'rocks glass';
}

export interface StepImageRecipe {
  name: string;
  tags: string[];
  ingredients: Array<{ name: string }>;
}

export interface StepImageRequest {
  /** Zero-based position of the step. */
  index: number;
  total: number;
  text: string;
  /** True when the hero photograph is attached to the same request. */
  hasReference: boolean;
}

/** One fixed description, so the cook looks the same in every frame. */
const COOK =
  'a home cook with short dark hair, wearing a plain grey linen apron over a white t-shirt';

const NO_PRINTED_TEXT =
  'No printed text, labels, logos or brand names anywhere, including on bottles, cartons and packaging.';

/** The first and last step show the cook; the ones between show hands only. */
function showsCook(index: number, total: number): boolean {
  return index === 0 || index === total - 1;
}

function cookClause(index: number, total: number): string {
  return showsCook(index, total)
    ? `Show the cook (${COOK}) from the chest up, one person only, with both arms ` +
        `attached to the body and exactly two hands — never a detached or floating hand. `
    : `Show only the hands and forearms of one cook, each arm attached to a person ` +
        `standing just outside the frame — never a detached or floating hand, ` +
        `never more than two hands, no faces. `;
}

/**
 * The prompt for one step image.
 *
 * Each step is its own request, so everything that has to stay the same across
 * the set is stated here and, where possible, shown: the hero photograph rides
 * along as a reference, and the wording below tells the model to match it.
 */
export function stepImagePrompt(
  recipe: StepImageRecipe,
  request: StepImageRequest,
): string {
  const { index, total, text, hasReference } = request;
  const reference = hasReference
    ? `Match the attached reference photograph exactly: the same ` +
      `${isDrink(recipe.tags) ? 'glass, garnish and bar' : 'cookware, dishes and kitchen'}, ` +
      `the same lighting and colours. `
    : '';

  if (isDrink(recipe.tags)) {
    const glass = glassFor(recipe.tags, recipe.ingredients);
    return (
      `Cocktail preparation for "${recipe.name}" — Step ${index + 1}: ${text} ` +
      reference +
      `The finished drink is always served in the same ${glass}; show no other glass, ` +
      `mug or vessel for it, and no paper umbrellas or straws unless this step says so. ` +
      cookClause(index, total) +
      `A home bar counter, soft warm lighting, close-up. ` +
      NO_PRINTED_TEXT +
      ` Photorealistic.`
    );
  }

  const cuisine = cuisineOf(recipe.tags);
  return (
    `Step ${index + 1} of "${recipe.name}": ${text} ` +
    (cuisine
      ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine. `
      : '') +
    reference +
    `Use one pot or pan per cooking stage and keep it the same wherever it appears. ` +
    cookClause(index, total) +
    `A home kitchen, warm natural lighting, close-up action shot. ` +
    NO_PRINTED_TEXT +
    ` Photorealistic.`
  );
}

export interface ReferenceImage {
  mimeType: string;
  data: string;
}

/** Text alone, or the reference photograph followed by the text. */
export function geminiContents(
  prompt: string,
  reference?: ReferenceImage,
): string | Array<{ inlineData: ReferenceImage } | { text: string }> {
  if (!reference) return prompt;
  return [{ inlineData: reference }, { text: prompt }];
}

/**
 * The file name a hero URL points at, or undefined if it is not one we wrote.
 *
 * Only `<id>.png` is accepted — letters, digits, underscore and hyphen — so a
 * stored URL can never be used to read a file outside the images folder.
 */
export function referenceFilename(heroUrl?: string): string | undefined {
  const filename = heroUrl?.split('/').pop();
  return filename && /^[\w-]+\.png$/.test(filename) ? filename : undefined;
}
