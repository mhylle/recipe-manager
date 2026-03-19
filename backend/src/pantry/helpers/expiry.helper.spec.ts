import { getExpiryStatus } from './expiry.helper';

describe('getExpiryStatus', () => {
  const referenceDate = new Date('2026-03-19T12:00:00.000Z');

  it('should return "expired" for past dates', () => {
    expect(getExpiryStatus('2026-03-18', referenceDate)).toBe('expired');
    expect(getExpiryStatus('2026-03-01', referenceDate)).toBe('expired');
    expect(getExpiryStatus('2025-12-31', referenceDate)).toBe('expired');
  });

  it('should return "expiring-soon" for dates within 3 days', () => {
    expect(getExpiryStatus('2026-03-19', referenceDate)).toBe('expiring-soon');
    expect(getExpiryStatus('2026-03-20', referenceDate)).toBe('expiring-soon');
    expect(getExpiryStatus('2026-03-21', referenceDate)).toBe('expiring-soon');
    expect(getExpiryStatus('2026-03-22', referenceDate)).toBe('expiring-soon');
  });

  it('should return "fresh" for dates more than 3 days away', () => {
    expect(getExpiryStatus('2026-03-23', referenceDate)).toBe('fresh');
    expect(getExpiryStatus('2026-04-01', referenceDate)).toBe('fresh');
    expect(getExpiryStatus('2026-12-31', referenceDate)).toBe('fresh');
  });

  it('should return "no-expiry" when no date is provided', () => {
    expect(getExpiryStatus(undefined, referenceDate)).toBe('no-expiry');
    expect(getExpiryStatus('', referenceDate)).toBe('no-expiry');
  });
});
