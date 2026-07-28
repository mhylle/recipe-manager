import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CookingTimerService, formatRemaining } from './cooking-timer.service';

describe('CookingTimerService', () => {
  let service: CookingTimerService;
  let clock: number;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1_000_000;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CookingTimerService);
    service.now = () => clock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Move both the wall clock and the interval scheduler forward together. */
  const advance = (seconds: number) => {
    clock += seconds * 1000;
    vi.advanceTimersByTime(seconds * 1000);
  };

  it('starts with nothing running', () => {
    expect(service.active()).toEqual([]);
  });

  it('counts down', () => {
    service.start('Rest the dough', 120);
    expect(service.active()[0].remainingSeconds).toBe(120);
    advance(30);
    expect(service.active()[0].remainingSeconds).toBe(90);
  });

  it('finishes when the time is up', () => {
    service.start('Bake', 60);
    advance(60);
    expect(service.active()).toHaveLength(0);
    expect(service.finished()).toHaveLength(1);
    expect(service.finished()[0].remainingSeconds).toBe(0);
  });

  it('is CORRECT after the tab was backgrounded and no ticks fired', () => {
    // The whole reason the timer stores an absolute end time. A phone throttles
    // or stops interval callbacks entirely; a counter that decremented per tick
    // would come back showing almost the full duration remaining.
    service.start('Prove overnight', 3600);

    // An hour of wall clock passes with only a single tick delivered.
    clock += 3600 * 1000;
    vi.advanceTimersByTime(1000);

    expect(service.finished()).toHaveLength(1);
    expect(service.active()).toHaveLength(0);
  });

  it('reports the right remaining time after a partial background gap', () => {
    service.start('Simmer', 600);
    clock += 400 * 1000;
    vi.advanceTimersByTime(1000);
    expect(service.active()[0].remainingSeconds).toBe(200);
  });

  it('runs several timers at once, each on its own schedule', () => {
    service.start('Short', 30);
    service.start('Long', 300);
    advance(30);
    expect(service.finished().map((t) => t.label)).toEqual(['Short']);
    expect(service.active().map((t) => t.label)).toEqual(['Long']);
    advance(270);
    expect(service.active()).toHaveLength(0);
    expect(service.finished()).toHaveLength(2);
  });

  it('cancels a timer without touching the others', () => {
    const first = service.start('Doomed', 300);
    service.start('Survivor', 300);
    service.cancel(first);
    expect(service.active().map((t) => t.label)).toEqual(['Survivor']);
  });

  it('keeps running the survivor after a cancel', () => {
    const doomed = service.start('Doomed', 60);
    service.start('Survivor', 120);
    service.cancel(doomed);
    advance(120);
    expect(service.finished().map((t) => t.label)).toEqual(['Survivor']);
  });

  it('dismisses a finished timer', () => {
    service.start('Bake', 10);
    advance(10);
    service.dismiss(service.finished()[0].id);
    expect(service.all()).toEqual([]);
  });

  it('clears all finished timers at once, leaving running ones alone', () => {
    service.start('Done', 10);
    service.start('Still going', 600);
    advance(10);
    service.clearFinished();
    expect(service.finished()).toEqual([]);
    expect(service.active().map((t) => t.label)).toEqual(['Still going']);
  });

  it('stops the interval once nothing is running, rather than ticking forever', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    service.start('Bake', 10);
    advance(10);
    expect(clearSpy).toHaveBeenCalled();
  });

  it('survives an environment with no audio support', () => {
    // jsdom has no AudioContext. Finishing a timer must not throw.
    service.start('Bake', 5);
    expect(() => advance(5)).not.toThrow();
    expect(service.finished()).toHaveLength(1);
  });
});

describe('formatRemaining', () => {
  it('shows m:ss under an hour', () => {
    expect(formatRemaining(90)).toBe('1:30');
    expect(formatRemaining(5)).toBe('0:05');
  });

  it('shows h:mm:ss at an hour and above', () => {
    expect(formatRemaining(3600)).toBe('1:00:00');
    expect(formatRemaining(7325)).toBe('2:02:05');
  });

  it('never shows a negative time', () => {
    expect(formatRemaining(-10)).toBe('0:00');
  });
});
