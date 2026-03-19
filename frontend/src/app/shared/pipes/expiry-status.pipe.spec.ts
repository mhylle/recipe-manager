import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExpiryStatusPipe } from './expiry-status.pipe';

describe('ExpiryStatusPipe', () => {
  let pipe: ExpiryStatusPipe;

  beforeEach(() => {
    pipe = new ExpiryStatusPipe();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "expired" for past dates', () => {
    expect(pipe.transform('2026-03-18')).toBe('expired');
    expect(pipe.transform('2026-03-01')).toBe('expired');
  });

  it('should return "expiring-soon" for dates within 3 days', () => {
    expect(pipe.transform('2026-03-19')).toBe('expiring-soon');
    expect(pipe.transform('2026-03-20')).toBe('expiring-soon');
    expect(pipe.transform('2026-03-22')).toBe('expiring-soon');
  });

  it('should return "fresh" for dates more than 3 days away', () => {
    expect(pipe.transform('2026-03-23')).toBe('fresh');
    expect(pipe.transform('2026-04-01')).toBe('fresh');
  });

  it('should return "no-expiry" when no date is provided', () => {
    expect(pipe.transform(undefined)).toBe('no-expiry');
    expect(pipe.transform('')).toBe('no-expiry');
  });
});
