import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** A timer as the client needs to see it. */
export interface ScheduledTimerView {
  id: string;
  title: string;
  body: string;
  /** ISO instant. The client turns this into a countdown against its own clock. */
  fireAt: string;
}

/** A claimed timer, ready to be delivered to whichever devices its owner has. */
export interface DueTimer {
  id: string;
  userId: string;
  title: string;
  body: string;
}

/** How long a rung timer is kept before being swept up. */
const RETAIN_FIRED_HOURS = 24;

/**
 * The timer promises themselves.
 *
 * Deliberately separate from PushService: this is bookkeeping that must be
 * correct whether or not push is configured, and it is the half that has a
 * meaningful contract with the client. Delivery is the other half's problem.
 */
@Injectable()
export class ScheduledTimerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Book a timer.
   *
   * Takes a DURATION, not an instant. The client's clock is not trustworthy —
   * a phone can sit minutes off — and a skewed `fireAt` would ring early or
   * late by exactly that error. Seconds-from-now has no such failure mode: the
   * only clock involved is the one that will do the firing.
   */
  async schedule(
    userId: string,
    input: { title: string; body: string; seconds: number },
  ): Promise<ScheduledTimerView> {
    const created = await this.prisma.scheduledTimer.create({
      data: {
        userId,
        title: input.title,
        body: input.body,
        fireAt: new Date(Date.now() + input.seconds * 1000),
      },
    });
    return this.toView(created);
  }

  /**
   * Everything still pending for this person.
   *
   * This is what makes a timer survive the app being killed: reopening the page
   * asks for the outstanding promises and rebuilds the countdown chips, rather
   * than showing an empty timer bar while the backend quietly holds three
   * timers that are about to ring.
   */
  async listPending(userId: string): Promise<ScheduledTimerView[]> {
    const rows = await this.prisma.scheduledTimer.findMany({
      where: { userId, firedAt: null },
      orderBy: { fireAt: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * Cancel one.
   *
   * Scoped to the owner, so an id guessed from another account is a 404 rather
   * than a silently successful delete of someone else's timer.
   */
  async cancel(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.scheduledTimer.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundException(`No pending timer ${id}`);
    }
  }

  /**
   * Claim every due timer, atomically.
   *
   * Claiming BEFORE sending is what stops a timer ringing twice: the poll runs
   * every few seconds, and a send that took longer than one interval would
   * otherwise be picked up again by the next pass. The cost is that a send which
   * fails transiently is not retried — but every one of a user's devices is
   * tried on that single pass, so losing the alarm needs all of them to fail at
   * once, and a second alarm arriving seconds after you already dealt with the
   * pan is its own kind of wrong.
   */
  async claimDue(now: Date, limit = 100): Promise<DueTimer[]> {
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.scheduledTimer.findMany({
        where: { firedAt: null, fireAt: { lte: now } },
        select: { id: true, userId: true, title: true, body: true },
        orderBy: { fireAt: 'asc' },
        take: limit,
      });
      if (due.length === 0) return [];

      await tx.scheduledTimer.updateMany({
        // The `firedAt: null` guard is redundant with one process polling and
        // load-bearing the moment there are two. Keeping it costs nothing.
        where: { id: { in: due.map((t) => t.id) }, firedAt: null },
        data: { firedAt: now },
      });
      return due;
    });
  }

  /**
   * Sweep rung timers.
   *
   * They are kept a day so a support question ("did it actually fire?") has an
   * answer, and dropped after that because nothing reads them again.
   */
  async purgeOldFired(now: Date): Promise<number> {
    const cutoff = new Date(
      now.getTime() - RETAIN_FIRED_HOURS * 60 * 60 * 1000,
    );
    const { count } = await this.prisma.scheduledTimer.deleteMany({
      where: { firedAt: { not: null, lt: cutoff } },
    });
    return count;
  }

  private toView(row: {
    id: string;
    title: string;
    body: string;
    fireAt: Date;
  }): ScheduledTimerView {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      fireAt: row.fireAt.toISOString(),
    };
  }
}
