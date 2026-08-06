import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PushService } from './push.service.js';
import { ScheduledTimerService } from './scheduled-timer.service.js';

/**
 * How often to look for due timers.
 *
 * Sets the worst-case lateness, so it wants to be small; every tick is a cheap
 * indexed query returning nothing, so it can be. Five seconds is inside the
 * noise for a dish that has been in the oven forty minutes, and 12 queries a
 * minute against an index that skips every already-rung row costs nothing worth
 * measuring.
 */
const POLL_MS = 5_000;

/** Sweep rung timers hourly — bookkeeping, not something to do every tick. */
const PURGE_EVERY_TICKS = (60 * 60 * 1000) / POLL_MS;

/**
 * Rings the timers.
 *
 * A poll loop rather than a setTimeout per timer, because a timeout lives in one
 * process's memory: a deploy, a crash or a restart silently forgets every
 * pending alarm, and this feature exists precisely because the previous
 * implementation lost timers when its host went away. The database row is the
 * promise, and the loop rediscovers it on every tick regardless of what happened
 * to the process in between.
 */
@Injectable()
export class TimerSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerSchedulerService.name);
  private loop: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;
  /** Guards against a slow tick overlapping the next interval. */
  private running = false;

  constructor(
    private readonly push: PushService,
    private readonly timers: ScheduledTimerService,
  ) {}

  onModuleInit(): void {
    if (!this.push.configured) {
      this.logger.warn(
        'Push is not configured — the timer scheduler is not starting.',
      );
      return;
    }
    this.loop = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    // Node keeps the process alive for an interval, which would hold a
    // shutdown open for up to POLL_MS. Nothing here needs to prevent exit.
    this.loop.unref?.();
    this.logger.log(`Timer scheduler polling every ${POLL_MS / 1000}s.`);
  }

  onModuleDestroy(): void {
    if (this.loop !== null) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  /**
   * One pass. Never rejects — an interval callback that throws takes the loop
   * down with it, and a scheduler that dies on one bad tick is worse than one
   * that logs and tries again in five seconds.
   */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.deliverDue();
      this.ticks += 1;
      if (this.ticks % PURGE_EVERY_TICKS === 0) {
        const purged = await this.timers.purgeOldFired(new Date());
        if (purged > 0) {
          this.logger.log(`Purged ${purged} rung timer(s).`);
        }
      }
    } catch (error) {
      this.logger.error(`Timer tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async deliverDue(): Promise<void> {
    const due = await this.timers.claimDue(new Date());
    if (due.length === 0) return;

    const subscriptions = await this.push.subscriptionsFor([
      ...new Set(due.map((timer) => timer.userId)),
    ]);
    if (subscriptions.length === 0) {
      // The timer is still marked rung. There is nowhere to deliver it, and
      // holding it pending would ring it whenever a device next subscribed —
      // possibly days later, for a dish long since eaten.
      this.logger.warn(
        `${due.length} timer(s) came due with no push subscription to deliver to.`,
      );
      return;
    }

    const dead: string[] = [];
    for (const timer of due) {
      const targets = subscriptions.filter(
        (sub) => sub.userId === timer.userId,
      );
      // Every device the person has, not just the one that started it: the
      // phone that set a 40-minute timer may well be face-down on a charger.
      const results = await Promise.all(
        targets.map((target) =>
          this.push.send(target, { title: timer.title, body: timer.body }),
        ),
      );
      results.forEach((result, index) => {
        if (result === 'gone') {
          dead.push(targets[index].id);
        }
      });
    }

    await this.push.pruneSubscriptions([...new Set(dead)]);
  }
}
