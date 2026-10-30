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
  /** What the drink's glass holds at this step; ignored for food. */
  glassState?: GlassState;
  /** Whether the garnish has been added by this step; ignored for food. */
  garnished?: boolean;
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
  const { index, total, text, hasReference, glassState, garnished } = request;
  const reference = hasReference
    ? `Match the attached reference photograph exactly: the same ` +
      `${isDrink(recipe.tags) ? 'glass shape and style, not its contents, the same garnish and bar' : 'cookware, dishes and kitchen'}, ` +
      `the same lighting and colours. `
    : '';

  if (isDrink(recipe.tags)) {
    const glass = glassFor(recipe.tags, recipe.ingredients);
    return (
      `Cocktail preparation for "${recipe.name}" — Step ${index + 1}: ${text} ` +
      glassStateSentence(glassState, hasReference) +
      reference +
      `The drink's glass is always the same ${glass}; show no other glass, ` +
      `mug or vessel for it, and no paper umbrellas or straws unless this step says so. ` +
      (garnished === false
        ? 'No garnish yet — none on the glass and none beside it. '
        : '') +
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

export type GlassState = 'absent' | 'ice' | 'filled';

/**
 * What the glass holds in this step, stated plainly and placed first.
 *
 * A filled glass is described as holding the reference's drink: told only to
 * match the glass's shape, the model drew an empty one in a step that was
 * about grating nutmeg over a finished drink.
 */
function glassStateSentence(
  state: GlassState | undefined,
  hasReference: boolean,
): string {
  switch (state) {
    case 'absent':
      return 'The glass is not in the shot in this step — show only the bar tools and ingredients. ';
    case 'ice':
      return 'If the glass is visible it holds only ice and no drink. ';
    case 'filled':
      return (
        'The glass is filled with the finished drink — full to just below the rim, never empty or clear. ' +
        (hasReference
          ? 'It holds the same drink as the reference photograph. '
          : '')
      );
    default:
      return '';
  }
}

const FILLED_STEP =
  /\b(strain\w*|serv(e|ed|ing)|garnish(ed)? (the|with|your|it)|perch\w*|float\w*|top(ped)? (it )?(off|with)|over the top|on the rim|sip\w*|pour\w* (\w+ ){0,3}into (\w+[ -]){0,3}glass)\b/i;
const ICED_GLASS_STEP = /\b(ice|chill\w*)\b/i;
const BAR_TOOL_STEP =
  /\b(shak\w*|shaker|jigger|measure\w*|muddl\w*|blend\w*|stir\w*)\b/i;

/**
 * What a step says is in the glass, or undefined when the text does not say.
 *
 * Undefined is a real answer: those steps go to the model, and only those. The
 * rules are deliberately narrow — a wrong confident answer here would never be
 * second-guessed — and read English, the language the images are made from.
 */
export function classifyGlassState(text: string): GlassState | undefined {
  if (FILLED_STEP.test(text)) return 'filled';
  const withoutMixingGlass = text.replace(/mixing glass/gi, '');
  if (/\bglass\b/i.test(withoutMixingGlass) && ICED_GLASS_STEP.test(text)) {
    return 'ice';
  }
  if (BAR_TOOL_STEP.test(text)) return 'absent';
  return undefined;
}

/**
 * One state per step, from the rules first and the model second.
 *
 * A step neither could read inherits the one before it. A filled glass is never
 * emptied again — a later line about shaking describes the text, not the glass —
 * but an iced one can leave the shot for the shaker steps.
 */
export function resolveGlassStates(
  fromRules: ReadonlyArray<GlassState | undefined>,
  fromModel: ReadonlyArray<GlassState | undefined> = [],
): GlassState[] {
  const states: GlassState[] = [];
  let current: GlassState = 'absent';
  fromRules.forEach((rule, index) => {
    const read = rule ?? fromModel[index];
    // Only a filled glass is permanent. An iced one can be set aside while the
    // shaker is worked, which is exactly what a step about shaking says.
    if (read && current !== 'filled') current = read;
    states.push(current);
  });
  return states;
}

/** The question put to the model for the steps the rules could not read. */
export function glassStatesPrompt(steps: readonly string[]): string {
  return (
    `Below are the numbered steps of a cocktail recipe. For each step say what ` +
    `the serving glass holds at the END of that step: "absent" if the glass has not ` +
    `been used or shown yet, "ice" if it only holds ice, "filled" if the drink has ` +
    `been poured into it. Answer with a JSON array of exactly ${steps.length} ` +
    `strings and nothing else.\n\n` +
    steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
  );
}

/** The model's answer as states, or undefined if it cannot be lined up with the steps. */
export function parseGlassStates(
  raw: string | undefined,
  count: number,
): Array<GlassState | undefined> | undefined {
  const start = raw?.indexOf('[') ?? -1;
  const end = raw?.lastIndexOf(']') ?? -1;
  if (!raw || start < 0 || end < start) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length !== count) return undefined;
    const values: unknown[] = parsed;
    return values.map((value): GlassState | undefined =>
      value === 'absent' || value === 'ice' || value === 'filled'
        ? value
        : undefined,
    );
  } catch {
    return undefined;
  }
}

const GARNISH_STEP =
  /\b(garnish\w*|perch\w*|wheel|slices?|wedge|sprig|twist|on the rim)\b/i;

/** For each step, whether the garnish has been added by then. Once on, it stays. */
export function garnishShown(steps: readonly string[]): boolean[] {
  let added = false;
  return steps.map((step) => {
    added = added || GARNISH_STEP.test(step);
    return added;
  });
}
