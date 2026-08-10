import { describe, it, expect } from 'vitest';
import {
  COURSE_TAGS,
  FILTER_TAGS,
  MAIN_COURSE_TAG,
  hasTag,
  matchesCourse,
  splitTags,
  toggleTag,
} from './recipe-tags';

describe('COURSE_TAGS', () => {
  it('offers Main, so the form can state what the filter matches on', () => {
    // The filter and the form read the same list. While Main lived only in the
    // filter, an author could not mark a dish as one — the defect this fixes.
    expect(COURSE_TAGS.map((option) => option.value)).toContain(MAIN_COURSE_TAG);
    expect(FILTER_TAGS.map((option) => option.value)).toContain(MAIN_COURSE_TAG);
  });
});

describe('matchesCourse', () => {
  it('matches a plain course by its tag', () => {
    expect(matchesCourse(['dessert', 'quick'], 'Dessert')).toBe(true);
    expect(matchesCourse(['dessert'], 'Soup')).toBe(false);
  });

  it('ignores capitalisation on both sides', () => {
    expect(matchesCourse(['DESSERT'], 'dessert')).toBe(true);
  });

  it('matches Main when the recipe says so', () => {
    expect(matchesCourse(['main', 'beef'], 'Main')).toBe(true);
  });

  it('still matches Main when no course is tagged at all', () => {
    // Every recipe written before the main tag existed carries no course. If
    // the tag were the only way in, turning it on would empty the facet.
    expect(matchesCourse(['italian', 'dinner'], 'Main')).toBe(true);
    expect(matchesCourse([], 'Main')).toBe(true);
  });

  it('does not call a dessert a main dish', () => {
    expect(matchesCourse(['dessert'], 'Main')).toBe(false);
    expect(matchesCourse(['baking', 'bread'], 'Main')).toBe(false);
  });

  it('takes an explicit main tag over the exclusion rule', () => {
    // A trifle that is somebody's main course is theirs to declare.
    expect(matchesCourse(['main', 'dessert'], 'Main')).toBe(true);
  });
});

describe('toggleTag', () => {
  it('adds a tag lowercased and leaves the free-text ones alone', () => {
    expect(toggleTag(['slow-cooked'], 'Main')).toEqual(['slow-cooked', 'main']);
  });

  it('removes a tag whatever its capitalisation', () => {
    expect(toggleTag(['Main', 'tacos'], 'main')).toEqual(['tacos']);
  });
});

describe('splitTags and hasTag', () => {
  it('reads the comma-separated field as a list', () => {
    expect(splitTags(' main , tacos ,, ')).toEqual(['main', 'tacos']);
  });

  it('finds a tag case-insensitively', () => {
    expect(hasTag(['Main'], 'main')).toBe(true);
    expect(hasTag(['mains'], 'main')).toBe(false);
  });
});
