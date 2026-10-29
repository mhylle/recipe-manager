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
      `The drink served in an appropriate glass with its garnish, on a bar top, ` +
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
