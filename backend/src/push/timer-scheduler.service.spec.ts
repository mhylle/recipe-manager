import { TimerSchedulerService } from './timer-scheduler.service';
import { PushService, type SendResult } from './push.service';
import {
  ScheduledTimerService,
  type DueTimer,
} from './scheduled-timer.service';

interface StubSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const subscription = (id: string, userId: string): StubSubscription => ({
  id,
  userId,
  endpoint: `https://push.example/${id}`,
  p256dh: 'p',
  auth: 'a',
});

const dueTimer = (id: string, userId: string): DueTimer => ({
  id,
  userId,
  title: 'Step 1 — Ancho Chilli Sauce',
  body: 'Timer finished',
});

/**
 * A scheduler under test, with both collaborators stubbed.
 *
 * `sendResults` maps an endpoint to what the push service answers, so a test can
 * say "this device is gone" without reaching into web-push.
 */
function build(due: DueTimer[], sendResults: Record<string, SendResult> = {}) {
  const subscriptions: StubSubscription[] = [];
  const sent: { endpoint: string; title: string; body: string }[] = [];
  const pruned: string[] = [];
  let claims = 0;

  // Promise.resolve rather than `async`: nothing here awaits anything, and an
  // async function without an await is a lint error.
  const push = {
    configured: true,
    subscriptionsFor: jest.fn((userIds: string[]) =>
      Promise.resolve(subscriptions.filter((s) => userIds.includes(s.userId))),
    ),
    send: jest.fn(
      (sub: { endpoint: string }, payload: { title: string; body: string }) => {
        sent.push({ endpoint: sub.endpoint, ...payload });
        return Promise.resolve(sendResults[sub.endpoint] ?? 'sent');
      },
    ),
    pruneSubscriptions: jest.fn((ids: string[]) => {
      pruned.push(...ids);
      return Promise.resolve();
    }),
  };

  const timers = {
    // Claiming is once-only in the real service. Mirroring that here stops a
    // test passing because the same timer came back on a later call.
    claimDue: jest.fn(() => Promise.resolve(++claims === 1 ? due : [])),
    purgeOldFired: jest.fn(() => Promise.resolve(0)),
  };

  const scheduler = new TimerSchedulerService(
    push as unknown as PushService,
    timers as unknown as ScheduledTimerService,
  );

  return { scheduler, push, timers, subscriptions, sent, pruned };
}

describe('TimerSchedulerService', () => {
  it('does nothing when nothing is due', async () => {
    const { scheduler, push } = build([]);
    await scheduler.tick();
    expect(push.send).not.toHaveBeenCalled();
  });

  it('delivers a due timer to the owner’s device', async () => {
    const t = build([dueTimer('t-1', 'u-1')]);
    t.subscriptions.push(subscription('s-1', 'u-1'));

    await t.scheduler.tick();

    expect(t.sent).toEqual([
      {
        endpoint: 'https://push.example/s-1',
        title: 'Step 1 — Ancho Chilli Sauce',
        body: 'Timer finished',
      },
    ]);
  });

  it('rings every device the owner has', async () => {
    // The phone that set a 40-minute timer may be face-down on a charger, so
    // delivering only to the device that started it is not good enough.
    const t = build([dueTimer('t-1', 'u-1')]);
    t.subscriptions.push(
      subscription('s-1', 'u-1'),
      subscription('s-2', 'u-1'),
    );

    await t.scheduler.tick();

    expect(t.sent.map((s) => s.endpoint)).toEqual([
      'https://push.example/s-1',
      'https://push.example/s-2',
    ]);
  });

  it('never delivers one user’s timer to another user’s device', async () => {
    const t = build([dueTimer('t-1', 'u-1')]);
    t.subscriptions.push(
      subscription('s-1', 'u-1'),
      subscription('s-2', 'u-2'),
    );

    await t.scheduler.tick();

    expect(t.sent.map((s) => s.endpoint)).toEqual(['https://push.example/s-1']);
  });

  it('prunes endpoints the push service reports as dead', async () => {
    const t = build([dueTimer('t-1', 'u-1')], {
      'https://push.example/s-1': 'gone',
    });
    t.subscriptions.push(
      subscription('s-1', 'u-1'),
      subscription('s-2', 'u-1'),
    );

    await t.scheduler.tick();

    expect(t.pruned).toEqual(['s-1']);
  });

  it('keeps endpoints that merely failed', async () => {
    // A transient 500 is not evidence the device is gone, and deleting on it
    // would silently stop that phone ever ringing again.
    const t = build([dueTimer('t-1', 'u-1')], {
      'https://push.example/s-1': 'failed',
    });
    t.subscriptions.push(subscription('s-1', 'u-1'));

    await t.scheduler.tick();

    expect(t.pruned).toEqual([]);
  });

  it('survives a collaborator that throws', async () => {
    // An interval callback that rejects takes the whole loop down with it, and a
    // scheduler that dies on one bad tick stops every future timer.
    const t = build([dueTimer('t-1', 'u-1')]);
    t.push.subscriptionsFor.mockRejectedValueOnce(new Error('database gone'));

    await expect(t.scheduler.tick()).resolves.toBeUndefined();
  });

  it('copes with a due timer that has nowhere to go', async () => {
    const t = build([dueTimer('t-1', 'u-1')]);

    await expect(t.scheduler.tick()).resolves.toBeUndefined();
    expect(t.push.send).not.toHaveBeenCalled();
  });

  it('does not start polling when push is unconfigured', () => {
    const t = build([]);
    t.push.configured = false;

    t.scheduler.onModuleInit();

    expect(t.timers.claimDue).not.toHaveBeenCalled();
    // No loop to tear down, and teardown must not throw over its absence.
    expect(() => t.scheduler.onModuleDestroy()).not.toThrow();
  });
});
