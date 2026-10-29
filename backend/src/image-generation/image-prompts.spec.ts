import { heroImagePrompt } from './image-prompts.js';

const recipe = {
  name: 'Frozen Limoncello Colada',
  description: 'A frozen pineapple and coconut cocktail.',
  tags: ['drink', 'cocktail'],
  ingredients: [{ name: 'Malibu' }, { name: 'Vodka' }],
};

describe('heroImagePrompt', () => {
  it('photographs a drink as a drink, in a glass', () => {
    const prompt = heroImagePrompt(recipe);
    expect(prompt).toContain('Frozen Limoncello Colada');
    expect(prompt).toMatch(/cocktail|drink/i);
    expect(prompt).toMatch(/glass/i);
    expect(prompt).not.toMatch(/plating|restaurant presentation/i);
  });

  it('keeps the plated-dish prompt for food', () => {
    const prompt = heroImagePrompt({
      ...recipe,
      name: 'Lasagne',
      tags: ['italian', 'main'],
    });
    expect(prompt).toMatch(/plating/i);
    expect(prompt).toContain('Italian cuisine style');
    expect(prompt).not.toMatch(/glass/i);
  });
});
