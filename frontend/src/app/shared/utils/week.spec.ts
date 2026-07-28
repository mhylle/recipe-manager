import { describe, it, expect } from 'vitest';
import { mondayOf } from './week';

describe('mondayOf', () => {
  it('returns the same day when given a Monday', () => {
    expect(mondayOf(new Date(2026, 6, 27))).toBe('2026-07-27');
  });

  it('walks back to Monday from mid-week', () => {
    expect(mondayOf(new Date(2026, 6, 30))).toBe('2026-07-27'); // Thursday
  });

  it('treats Sunday as the END of its week, not the start', () => {
    // Distractor: `date - getDay()` pushes Sunday into the following week.
    expect(mondayOf(new Date(2026, 7, 2))).toBe('2026-07-27');
  });

  it('does not shift a day at local midnight', () => {
    // The bug this replaces: toISOString() on a local-midnight Date converts to
    // UTC and lands on the previous day in any positive-offset zone. These dates
    // are constructed at 00:00 local, so a regression fails here immediately.
    expect(mondayOf(new Date(2026, 6, 27, 0, 0, 0))).toBe('2026-07-27');
    expect(mondayOf(new Date(2026, 6, 27, 0, 30, 0))).toBe('2026-07-27');
    expect(mondayOf(new Date(2026, 6, 27, 1, 59, 0))).toBe('2026-07-27');
  });

  it('handles a month boundary', () => {
    expect(mondayOf(new Date(2026, 7, 1))).toBe('2026-07-27'); // Sat 1 Aug
  });

  it('handles a year boundary', () => {
    expect(mondayOf(new Date(2027, 0, 1))).toBe('2026-12-28'); // Fri 1 Jan 2027
  });

  it('zero-pads single-digit months and days', () => {
    expect(mondayOf(new Date(2026, 0, 8))).toBe('2026-01-05');
  });
});
