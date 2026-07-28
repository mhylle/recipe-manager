import { describe, it, expect } from 'vitest';
import { parseStepDurations } from './step-duration';

/**
 * Every string below is real text from a production recipe, in the language the
 * app would be displaying it in. Invented examples would not have caught
 * "3-5mm", "i mindst 2 timer" or "(10 min.)".
 */

describe('parseStepDurations — English', () => {
  const parse = (text: string) => parseStepDurations(text, 'en');

  it('finds a simple duration', () => {
    expect(parse('Let the round rest for 1 hour under a cloth.')).toEqual([
      expect.objectContaining({ seconds: 3600 }),
    ]);
  });

  it('handles plural hours', () => {
    expect(
      parse('Return the dough to the bowl, spritz a little water on top, cover, and leave for 2 hours.'),
    ).toEqual([expect.objectContaining({ seconds: 7200 })]);
  });

  it('handles minutes', () => {
    expect(parse('Bake for 20 minutes at 250°C.')).toEqual([
      expect.objectContaining({ seconds: 1200 }),
    ]);
  });

  it('handles the abbreviated form with a trailing period', () => {
    const found = parse(
      'For the curry sauce: heat oil in a saucepan, sauté diced onion until soft (10 min). Add garlic',
    );
    expect(found[0].seconds).toBe(600);
  });

  it('takes the LOWER bound of a range', () => {
    // A timer that fires early gets checked early. One that fires late is a
    // burnt dish, so the conservative bound is the useful one.
    expect(parse('Bake at 190°C (375°F) for 15-20 minutes until cheese is melted and bubbly')[0].seconds)
      .toBe(900);
  });

  it('finds several durations in one step, in order', () => {
    const found = parse(
      'Cook the onions for 45-60 minutes, stirring every 5 minutes, until deeply golden brown and jammy.',
    );
    expect(found.map((d) => d.seconds)).toEqual([2700, 300]);
  });

  it('finds both durations in the two-step bake', () => {
    expect(parse('Add garlic and cook 1 minute. Add flour and stir 1 minute').map((d) => d.seconds))
      .toEqual([60, 60]);
  });

  it('handles seconds', () => {
    expect(parse('Blitz for 30 seconds until smooth')[0].seconds).toBe(30);
  });

  describe('does NOT match', () => {
    it('a temperature', () => {
      expect(parse('Heat the oven to 250°C and hold it there.')).toEqual([]);
    });

    it('a Fahrenheit conversion', () => {
      expect(parse('Preheat to 190°C (375°F)')).toEqual([]);
    });

    it('a millimetre measurement — "5mm" is not "5 min"', () => {
      expect(parse('Slice pork shoulder thinly (3-5mm) and coat thoroughly with the marinade.')).toEqual([]);
    });

    it('a tin size', () => {
      expect(parse('Roll pastry out and line a 25cm tart tin.')).toEqual([]);
    });

    it('a bare "overnight" with no number', () => {
      // Better to offer nothing than to invent a number for it.
      expect(parse('Shape the loaf and place it in the proofing basket in the fridge overnight.')).toEqual([]);
    });

    it('a count of things that is not a duration', () => {
      expect(parse('Do 12 stretch and folds, finishing so the bottom ends up facing upwards.')).toEqual([]);
    });

    it('"this time" followed by a count', () => {
      expect(
        parse('Repeat: water on the worktop, dough out with the top facing down, this time 6 stretch and folds.'),
      ).toEqual([]);
    });
  });
});

describe('parseStepDurations — Danish', () => {
  const parse = (text: string) => parseStepDurations(text, 'da');

  it('handles singular "time"', () => {
    expect(parse('Lad bollen hvile 1 time med et klæde over.')[0].seconds).toBe(3600);
  });

  it('handles plural "timer"', () => {
    expect(parse('Tilbage i skålen, lidt vand på toppen, tildækket i 2 timer.')[0].seconds).toBe(7200);
  });

  it('handles "minutter"', () => {
    expect(parse('Bag 20 minutter ved 250 °C.')[0].seconds).toBe(1200);
  });

  it('handles singular "minut"', () => {
    expect(parse('Tilsæt hvidløg, og lad det stege 1 minut.')[0].seconds).toBe(60);
  });

  it('handles the abbreviated "min." with a period', () => {
    expect(parse('Til karrysaucen: varm olie i en gryde, og svits det hakkede løg blødt (10 min.).')[0].seconds)
      .toBe(600);
  });

  it('takes the lower bound of a range', () => {
    expect(parse('Bag ved 190 °C i 15-20 minutter, til osten er smeltet og bobler')[0].seconds).toBe(900);
  });

  it('handles "sekunder"', () => {
    expect(parse('Blend i 30 sekunder, til massen er glat')[0].seconds).toBe(30);
  });

  it('reads "i mindst 2 timer" as 2 hours — "mindst" must not be mistaken for "min"', () => {
    expect(parse('Stil dem på køl i mindst 2 timer, gerne natten over.')[0].seconds).toBe(7200);
  });

  it('handles "cirka" before the number', () => {
    expect(parse('Når bunden er sat og gylden (cirka 2 minutter), drejes hver æbleskive 90 grader')[0].seconds)
      .toBe(120);
  });

  describe('does NOT match', () => {
    it('a temperature with a space before the degree sign', () => {
      expect(parse('Varm ovnen op til 250 °C.')).toEqual([]);
    });

    it('millimetres', () => {
      expect(parse('Skær svinebov i tynde skiver (3-5 mm), og vend dem grundigt i marinaden.')).toEqual([]);
    });

    it('centimetres', () => {
      expect(parse('Rul dejen ud, og beklæd en tærteform på 25 cm.')).toEqual([]);
    });

    it('degrees of rotation', () => {
      expect(parse('drejes hver æbleskive 90 grader med en strikkepind')).toEqual([]);
    });

    it('"natten over" with no number', () => {
      expect(parse('Form brødet og sæt det i hævekurven på køl i køleskabet natten over.')).toEqual([]);
    });

    it('a count of stretch and folds', () => {
      expect(parse('Lav 12 stretch and folds, og slut af så bunden kommer til at vende op.')).toEqual([]);
    });
  });
});

describe('parseStepDurations — shared behaviour', () => {
  it('reports where in the text each duration was found', () => {
    const [first, second] = parseStepDurations('Cook 5 minutes then rest 10 minutes', 'en');
    expect(first.text).toBe('5 minutes');
    expect(second.text).toBe('10 minutes');
    expect(second.index).toBeGreaterThan(first.index);
  });

  it('handles a decimal duration', () => {
    expect(parseStepDurations('Simmer for 1.5 hours', 'en')[0].seconds).toBe(5400);
  });

  it('handles a comma decimal, as Danish writes it', () => {
    expect(parseStepDurations('Lad den simre i 1,5 timer', 'da')[0].seconds).toBe(5400);
  });

  it('returns an empty list for text with no duration at all', () => {
    expect(parseStepDurations('Season generously with salt', 'en')).toEqual([]);
  });

  it('ignores an absurd value rather than offering a 100-hour timer', () => {
    expect(parseStepDurations('Leave for 500 hours', 'en')).toEqual([]);
  });
});
