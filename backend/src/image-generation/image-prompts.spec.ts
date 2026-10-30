import {
  geminiContents,
  glassFor,
  heroImagePrompt,
  referenceFilename,
  stepImagePrompt,
} from './image-prompts.js';

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

const names = (...n: string[]) => n.map((name) => ({ name }));

describe('glassFor', () => {
  it('puts tropical drinks in a hurricane glass, whatever else is true', () => {
    expect(
      glassFor(['drink', 'rum'], names('Dark rum', 'Pineapple juice')),
    ).toBe('hurricane glass');
    expect(glassFor(['drink', 'frozen'], names('Vodka'))).toBe(
      'hurricane glass',
    );
  });

  it('gives a stirred or sour drink its own glass', () => {
    expect(glassFor(['drink', 'sour'], names('Gin', 'Lemon juice'))).toBe(
      'coupe glass',
    );
  });

  it('falls back to one plain glass rather than leaving it to the model', () => {
    expect(glassFor(['drink'], names('Gin', 'Campari', 'Vermouth'))).toBe(
      'rocks glass',
    );
  });

  it('is the same answer every time for the same recipe', () => {
    const a = glassFor(['drink'], names('Gin'));
    expect(glassFor(['drink'], names('Gin'))).toBe(a);
  });
});

describe('hero prompt for a drink', () => {
  it('names the glass', () => {
    expect(
      heroImagePrompt({
        ...recipe,
        ingredients: names('Malibu', 'Pineapple juice'),
      }),
    ).toContain('hurricane glass');
  });
});

describe('stepImagePrompt', () => {
  const food = {
    name: 'Birria',
    tags: ['mexican', 'beef'],
    ingredients: names('Beef', 'Chillies'),
  };
  const drink = {
    name: 'Painkiller',
    tags: ['drink', 'cocktail', 'rum'],
    ingredients: names('Dark rum', 'Pineapple juice', 'Coconut milk'),
  };
  const step = (
    recipe: typeof food,
    index: number,
    text = 'Do the thing.',
    hasReference = true,
    total = 6,
  ) => stepImagePrompt(recipe, { index, total, text, hasReference });

  it('carries the step text and number', () => {
    const prompt = step(food, 2, 'Brown the meat.');
    expect(prompt).toContain('Step 3');
    expect(prompt).toContain('Brown the meat.');
  });

  it('never allows a detached hand, in any step', () => {
    for (const index of [0, 1, 3, 5]) {
      expect(step(food, index)).toMatch(/never a (detached|floating)/i);
    }
  });

  it('shows only hands in the middle steps, attached to someone, no faces', () => {
    const prompt = step(food, 2);
    expect(prompt).toMatch(/only the hands and forearms/i);
    expect(prompt).toMatch(/attached to a person/i);
    expect(prompt).toMatch(/no faces/i);
    expect(prompt).not.toMatch(/chest up/i);
  });

  it('shows the cook in the first and the last step', () => {
    for (const index of [0, 5]) {
      expect(step(food, index)).toMatch(/chest up/i);
    }
    expect(step(food, 2)).not.toMatch(/chest up/i);
  });

  it('shows the cook when there is only one step', () => {
    expect(step(food, 0, 'Stir.', true, 1)).toMatch(/chest up/i);
  });

  it('describes the cook the same way in every frame they appear in', () => {
    const cook = (p: string) => /home cook[^.]*apron[^.]*/i.exec(p)?.[0];
    expect(cook(step(food, 0))).toBeDefined();
    expect(cook(step(food, 0))).toBe(cook(step(food, 5)));
    expect(cook(step(drink, 0))).toBe(cook(step(food, 0)));
  });

  it('forbids printed text, labels and brand names', () => {
    expect(step(food, 1)).toMatch(/no (printed )?text.*labels/i);
  });

  it('points at the reference photograph only when one is attached', () => {
    expect(step(food, 1)).toMatch(/reference photograph/i);
    expect(step(food, 1, 'x', false)).not.toMatch(/reference/i);
  });

  it('treats a drink step as bar work in the one glass, not as cooking', () => {
    const prompt = step(drink, 5, 'Garnish with an orange wheel.');
    expect(prompt).toContain('hurricane glass');
    expect(prompt).not.toMatch(/cooking process/i);
    expect(prompt).toMatch(/no other (glass|mug|vessel)/i);
    expect(prompt).toMatch(/umbrella|straw/i); // only to forbid them
  });

  it('does not mention a glass for a plated dish', () => {
    expect(step(food, 1)).not.toMatch(/glass/i);
  });
});

describe('geminiContents', () => {
  it('sends plain text when there is no reference', () => {
    expect(geminiContents('hello')).toBe('hello');
  });

  it('puts the reference image before the text, as inline data', () => {
    const contents = geminiContents('hello', {
      mimeType: 'image/png',
      data: 'QUJD',
    });
    expect(contents).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'QUJD' } },
      { text: 'hello' },
    ]);
  });
});

describe('referenceFilename', () => {
  it('takes the saved file name from a hero URL', () => {
    expect(
      referenceFilename('/api/recipe-manager/images/recipes/1c715270-9a1f.png'),
    ).toBe('1c715270-9a1f.png');
  });

  it.each([
    undefined,
    '',
    '/images/recipes/..%2f..%2fsecret.png',
    '/images/recipes/a.b.png',
    '/images/recipes/hero.jpg',
    '/images/recipes/',
  ])('refuses %p, so a stored URL cannot name another file', (url) => {
    expect(referenceFilename(url)).toBeUndefined();
  });
});
