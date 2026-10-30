import {
  classifyGlassState,
  geminiContents,
  garnishShown,
  glassStatesPrompt,
  parseGlassStates,
  resolveGlassStates,
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

const PAINKILLER = [
  'Fill a glass with ice and set it aside to chill while you get the good stuff ready.',
  "Pour the dark rum, pineapple juice, orange juice and coconut milk into a shaker — give the coconut milk a quick stir first so it's nice and smooth.",
  "Add a handful of ice, lid on, and shake like you're trying to wake up the sun. About 15 seconds, until the shaker is properly frosty.",
  'Strain into your ice-filled glass and admire that golden, sunset colour.',
  "Grate a little nutmeg over the top — it's the cozy, warming finish that makes this drink a Painkiller.",
  'Perch an orange wheel on the rim, kick back somewhere comfy and let the Painkiller live up to its name.',
];

describe('classifyGlassState', () => {
  it('reads the Painkiller: ice, shaker work, then filled from the strain on', () => {
    expect(PAINKILLER.map(classifyGlassState)).toEqual([
      'ice',
      'absent',
      'absent',
      'filled',
      'filled',
      'filled',
    ]);
  });

  it('tells pouring into the shaker from pouring into the glass', () => {
    expect(classifyGlassState('Pour the rum into the shaker.')).toBe('absent');
    expect(classifyGlassState('Pour the rum into the glass.')).toBe('filled');
  });

  it('puts a chilled empty glass at ice only', () => {
    expect(classifyGlassState('Chill a rocks glass with ice.')).toBe('ice');
  });

  it('says nothing about a step it cannot read', () => {
    expect(classifyGlassState('Let it rest for a moment.')).toBeUndefined();
  });
});

describe('resolveGlassStates', () => {
  it('lets a rule beat the model', () => {
    expect(resolveGlassStates(['ice'], ['filled'])).toEqual(['ice']);
  });

  it('uses the model for a step the rules left open', () => {
    expect(
      resolveGlassStates(['absent', undefined], [undefined, 'ice']),
    ).toEqual(['absent', 'ice']);
  });

  it('carries the previous state over when nobody knows', () => {
    expect(resolveGlassStates([undefined, 'ice', undefined])).toEqual([
      'absent',
      'ice',
      'ice',
    ]);
  });

  it('takes the iced glass out of the shot for shaker work, then fills it', () => {
    // The Painkiller as classified: ice, shaker, shaker, then the strain.
    expect(
      resolveGlassStates([
        'ice',
        'absent',
        'absent',
        'filled',
        'filled',
        'filled',
      ]),
    ).toEqual(['ice', 'absent', 'absent', 'filled', 'filled', 'filled']);
  });

  it('lets the model take an iced glass out of the shot too', () => {
    expect(
      resolveGlassStates(['ice', undefined], [undefined, 'absent']),
    ).toEqual(['ice', 'absent']);
  });

  it('never empties a glass that has been filled', () => {
    // Distractor: a step about shaking after the pour is a reading of the
    // text, not the glass being emptied again.
    expect(resolveGlassStates(['filled', 'absent', 'ice'])).toEqual([
      'filled',
      'filled',
      'filled',
    ]);
  });
});

describe('parseGlassStates', () => {
  it('reads a plain or fenced JSON array', () => {
    expect(parseGlassStates('["absent","ice","filled"]', 3)).toEqual([
      'absent',
      'ice',
      'filled',
    ]);
    expect(parseGlassStates('```json\n["ice","filled"]\n```', 2)).toEqual([
      'ice',
      'filled',
    ]);
  });

  it('discards an answer of the wrong length rather than misaligning steps', () => {
    expect(parseGlassStates('["ice"]', 3)).toBeUndefined();
  });

  it('keeps the good entries and drops the unknown words', () => {
    expect(parseGlassStates('["ice","bubbles"]', 2)).toEqual([
      'ice',
      undefined,
    ]);
  });

  it.each(['', 'not json', '{"a":1}', undefined])('survives %p', (raw) => {
    expect(parseGlassStates(raw, 2)).toBeUndefined();
  });
});

describe('glassStatesPrompt', () => {
  it('numbers every step it asks about', () => {
    const prompt = glassStatesPrompt(['Shake.', 'Strain.']);
    expect(prompt).toContain('1. Shake.');
    expect(prompt).toContain('2. Strain.');
    expect(prompt).toMatch(/JSON array/i);
    expect(prompt).toMatch(/absent.*ice.*filled/is);
  });
});

describe('a drink step knows what is in the glass', () => {
  const drink = {
    name: 'Painkiller',
    tags: ['drink', 'cocktail', 'rum'],
    ingredients: names('Dark rum', 'Pineapple juice', 'Coconut milk'),
  };
  const withState = (glassState?: 'absent' | 'ice' | 'filled') =>
    stepImagePrompt(drink, {
      index: 2,
      total: 6,
      text: 'Shake.',
      hasReference: true,
      glassState,
    });

  it('keeps the glass out of the shot before it is used', () => {
    expect(withState('absent')).toMatch(/glass is not in the shot/i);
  });

  it('shows an iced glass as holding only ice', () => {
    expect(withState('ice')).toMatch(/only ice/i);
  });

  it('fills the glass only once it is filled', () => {
    expect(withState('filled')).toMatch(/filled with the finished drink/i);
    expect(withState('absent')).not.toMatch(/filled with the finished drink/i);
  });

  it('takes the glass SHAPE from the reference, not its contents', () => {
    expect(withState('absent')).toMatch(/shape and style, not its contents/i);
  });

  it('says nothing about contents when the state is unknown', () => {
    expect(withState(undefined)).not.toMatch(
      /only ice|not in the shot|filled with/i,
    );
  });
});

describe('garnishShown', () => {
  it('shows the garnish only from the step that adds it, and keeps it', () => {
    expect(garnishShown(PAINKILLER)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(garnishShown(['Garnish with a lime wheel.', 'Serve.'])).toEqual([
      true,
      true,
    ]);
  });

  it('does not count nutmeg over the top as a garnish step', () => {
    expect(garnishShown(['Grate nutmeg over the top.'])).toEqual([false]);
  });
});

describe('a drink step knows about the garnish', () => {
  const drink = {
    name: 'Painkiller',
    tags: ['drink'],
    ingredients: names('Dark rum'),
  };
  const garnished = (value?: boolean) =>
    stepImagePrompt(drink, {
      index: 1,
      total: 6,
      text: 'Shake.',
      hasReference: true,
      garnished: value,
    });

  it('keeps the garnish off until the step that adds it', () => {
    expect(garnished(false)).toMatch(/no garnish yet/i);
  });

  it('allows it once it has been added', () => {
    expect(garnished(true)).not.toMatch(/no garnish yet/i);
  });

  it('says nothing when it is not known', () => {
    expect(garnished(undefined)).not.toMatch(/garnish yet/i);
  });
});
