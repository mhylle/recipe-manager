import type { Locale } from '../../shared/i18n/locale';

/** A duration found in an instruction step, ready to become a timer. */
export interface StepDuration {
  /** Total length in seconds. */
  seconds: number;
  /** The matched substring, e.g. "15-20 minutes". */
  text: string;
  /** Where the match starts, so several timers on one step keep step order. */
  index: number;
}

/**
 * Nobody times a dish for four days, so a match that large is far more likely to
 * be a misread than a real instruction. Rejecting it costs a timer that would
 * never have been used; accepting it puts nonsense in the UI.
 */
const MAX_SECONDS = 24 * 60 * 60;

type UnitPattern = { pattern: string; seconds: number };

/**
 * Unit words per language, longest-first so "minutter" is tried before "min".
 *
 * Everything here is anchored on a preceding number and terminated by a word
 * boundary, which is what keeps the near-misses out: "3-5mm" has no time word,
 * "mindst" never matches `min` because of the trailing `dst`, and a temperature
 * like "250 °C" has no time word after the number at all.
 */
const UNITS: Record<Locale, UnitPattern[]> = {
  en: [
    { pattern: 'hours|hour|hrs|hr', seconds: 3600 },
    { pattern: 'minutes|minute|mins|min', seconds: 60 },
    { pattern: 'seconds|second|secs|sec', seconds: 1 },
  ],
  da: [
    { pattern: 'timer|time', seconds: 3600 },
    { pattern: 'minutter|minutter|minut|min', seconds: 60 },
    { pattern: 'sekunder|sekund', seconds: 1 },
  ],
};

function buildPattern(locale: Locale): RegExp {
  const units = UNITS[locale] ?? UNITS.en;
  const words = units.map((u) => u.pattern).join('|');
  // number [ – number ] unit [.]
  // The optional second number is a range; we keep the first.
  return new RegExp(
    String.raw`(\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*\d+(?:[.,]\d+)?\s*)?(${words})\b\.?`,
    'gi',
  );
}

function secondsPerUnit(locale: Locale, word: string): number {
  const units = UNITS[locale] ?? UNITS.en;
  const lower = word.toLowerCase();
  for (const unit of units) {
    if (unit.pattern.split('|').includes(lower)) {
      return unit.seconds;
    }
  }
  return 0;
}

/**
 * Every timeable duration mentioned in a step, in the order they appear.
 *
 * A range yields its LOWER bound: a timer that fires early gets the dish checked
 * early, whereas one that fires late is a burnt dish. Text with no number —
 * "overnight", "natten over" — yields nothing rather than a guess.
 *
 * The text must be in `locale`, because the unit words differ and Danish "time"
 * means hour. Reading Danish with English rules, or the reverse, silently finds
 * nothing.
 */
export function parseStepDurations(text: string, locale: Locale): StepDuration[] {
  const pattern = buildPattern(locale);
  const found: StepDuration[] = [];

  for (const match of text.matchAll(pattern)) {
    const amount = Number(match[1].replace(',', '.'));
    const seconds = Math.round(amount * secondsPerUnit(locale, match[2]));

    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
      continue;
    }

    found.push({
      seconds,
      // Trim a trailing period so the label reads "10 min", not "10 min.".
      text: match[0].replace(/\.$/, '').trim(),
      index: match.index ?? 0,
    });
  }

  return found;
}
