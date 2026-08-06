import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CookingTimerService } from './cooking-timer.service';
import { TimerPushService, type ServerTimer } from './timer-push.service';

/**
 * The half of the timer service that talks to the backend.
 *
 * Kept apart from cooking-timer.service.spec.ts, which deliberately runs with no
 * push at all and covers the local countdown. Here TimerPushService is replaced
 * wholesale, so these cases describe the contract between the two rather than
 * anything about HTTP.
 */

function createPushFake() {
  const fake = {
    scheduled: [] as { title: string; body: string; seconds: number }[],
    cancelled: [] as string[],
    /** What the next schedule() resolves to. Null models a failed booking. */
    nextId: 'server-1' as string | null,
    /** Held open so a test can decide when the booking comes back. */
    deferred: null as null | { resolve: (id: string | null) => void },
    pendingTimers: [] as ServerTimer[],

    schedule(title: string, body: string, seconds: number): Promise<string | null> {
      fake.scheduled.push({ title, body, seconds });
      if (fake.deferred !== null) {
        return new Promise<string | null>((resolve) => {
          fake.deferred = { resolve };
        });
      }
      return Promise.resolve(fake.nextId);
    },
    cancel(id: string): Promise<void> {
      fake.cancelled.push(id);
      return Promise.resolve();
    },
    pending(): Promise<ServerTimer[]> {
      return Promise.resolve(fake.pendingTimers);
    },
  };
  return fake;
}

describe('CookingTimerService — ringing on the phone', () => {
  let service: CookingTimerService;
  let push: ReturnType<typeof createPushFake>;
  let clock: number;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1_000_000;
    TestBed.resetTestingModule();
    push = createPushFake();
    TestBed.configureTestingModule({
      providers: [{ provide: TimerPushService, useValue: push }],
    });
    service = TestBed.inject(CookingTimerService);
    service.now = () => clock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const advance = (seconds: number) => {
    clock += seconds * 1000;
    vi.advanceTimersByTime(seconds * 1000);
  };

  /** Let the fire-and-forget booking promise settle. */
  const settle = () => Promise.resolve().then(() => undefined);

  it('books a timer server-side when given translated notification text', async () => {
    service.start('Step 3 — Ancho Chilli Sauce', 600, 'Timer finished');
    await settle();

    expect(push.scheduled).toEqual([
      { title: 'Step 3 — Ancho Chilli Sauce', body: 'Timer finished', seconds: 600 },
    ]);
    expect(service.active()[0].serverId).toBe('server-1');
  });

  it('sends a DURATION, never an instant', async () => {
    // The backend does the arithmetic against its own clock, so a phone that is
    // minutes off still rings on time.
    service.start('Step 1', 90, 'Done');
    await settle();

    expect(push.scheduled[0].seconds).toBe(90);
  });

  it('stays local-only when the caller has no translated text to offer', async () => {
    // Rather than putting an English string on a Danish lock screen.
    service.start('Step 1', 600);
    await settle();

    expect(push.scheduled).toEqual([]);
    expect(service.active()[0].serverId).toBeUndefined();
  });

  it('keeps a working countdown when the booking fails', async () => {
    push.nextId = null;
    service.start('Step 1', 120, 'Done');
    await settle();

    expect(service.active()[0].serverId).toBeUndefined();
    advance(30);
    expect(service.active()[0].remainingSeconds).toBe(90);
  });

  it('withdraws the booking when the user cancels the timer', async () => {
    const id = service.start('Step 1', 600, 'Done');
    await settle();

    service.cancel(id);

    expect(push.cancelled).toEqual(['server-1']);
  });

  it('withdraws a booking that arrives after the timer was already cancelled', async () => {
    // Otherwise the phone rings for a timer that is gone from the screen.
    push.deferred = { resolve: () => undefined };
    const id = service.start('Step 1', 600, 'Done');
    service.cancel(id);

    push.deferred.resolve('server-late');
    await settle();
    await settle();

    expect(push.cancelled).toContain('server-late');
    expect(service.all()).toEqual([]);
  });

  it('withdraws the phone copy when the timer rings here first', async () => {
    // The page is open and has just beeped, so a lock-screen notification for
    // the same alarm is redundant.
    service.start('Step 1', 10, 'Done');
    await settle();

    advance(10);

    expect(push.cancelled).toEqual(['server-1']);
    expect(service.finished()[0].finished).toBe(true);
  });

  it('does not try to withdraw the same booking twice', async () => {
    service.start('Step 1', 10, 'Done');
    await settle();
    advance(10);

    // Dismissing the finished chip must not re-cancel what already rang.
    service.dismiss(service.finished()[0].id);

    expect(push.cancelled).toEqual(['server-1']);
  });

  describe('restore', () => {
    it('rebuilds a countdown the backend is still holding', async () => {
      push.pendingTimers = [
        {
          id: 'server-9',
          title: 'Step 2 — Sourdough',
          body: 'Timer finished',
          fireAt: new Date(clock + 300_000).toISOString(),
        },
      ];

      await service.restore();

      expect(service.active()).toHaveLength(1);
      expect(service.active()[0].label).toBe('Step 2 — Sourdough');
      expect(service.active()[0].remainingSeconds).toBe(300);
      expect(service.active()[0].serverId).toBe('server-9');
    });

    it('ignores timers whose moment has already passed', async () => {
      // They rang on the phone while the app was closed; resurrecting them as
      // finished chips would demand a second dismissal.
      push.pendingTimers = [
        {
          id: 'server-old',
          title: 'Step 1',
          body: 'Timer finished',
          fireAt: new Date(clock - 60_000).toISOString(),
        },
      ];

      await service.restore();

      expect(service.all()).toEqual([]);
    });

    it('runs once per session, however many recipes are opened', async () => {
      push.pendingTimers = [
        {
          id: 'server-9',
          title: 'Step 2',
          body: 'Timer finished',
          fireAt: new Date(clock + 300_000).toISOString(),
        },
      ];

      await service.restore();
      await service.restore();

      expect(service.all()).toHaveLength(1);
    });

    it('does not duplicate a timer already running locally', async () => {
      service.start('Step 1', 600, 'Done');
      await settle();
      push.pendingTimers = [
        {
          id: 'server-1',
          title: 'Step 1',
          body: 'Done',
          fireAt: new Date(clock + 600_000).toISOString(),
        },
      ];

      await service.restore();

      expect(service.all()).toHaveLength(1);
    });

    it('keeps the restored countdown ticking', async () => {
      push.pendingTimers = [
        {
          id: 'server-9',
          title: 'Step 2',
          body: 'Timer finished',
          fireAt: new Date(clock + 60_000).toISOString(),
        },
      ];
      await service.restore();

      advance(20);

      expect(service.active()[0].remainingSeconds).toBe(40);
    });
  });
});
