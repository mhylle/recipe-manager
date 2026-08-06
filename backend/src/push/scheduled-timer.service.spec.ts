import { NotFoundException } from '@nestjs/common';
import { ScheduledTimerService } from './scheduled-timer.service';
import { PrismaService } from '../prisma/prisma.service';

// An in-memory ScheduledTimer table. Only the query shapes the service actually
// issues are supported — a general-purpose Prisma emulator would be a bigger
// thing to trust than the code under test.

interface Row {
  id: string;
  userId: string;
  title: string;
  body: string;
  fireAt: Date;
  firedAt: Date | null;
  createdAt: Date;
}

type Where = {
  id?: string | { in: string[] };
  userId?: string;
  firedAt?: null | { not: null; lt: Date };
  fireAt?: { lte: Date };
};

function matches(row: Row, where: Where = {}): boolean {
  if (where.id !== undefined) {
    if (typeof where.id === 'string') {
      if (row.id !== where.id) return false;
    } else if (!where.id.in.includes(row.id)) {
      return false;
    }
  }
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.firedAt !== undefined) {
    if (where.firedAt === null) {
      if (row.firedAt !== null) return false;
    } else {
      if (row.firedAt === null) return false;
      if (!(row.firedAt.getTime() < where.firedAt.lt.getTime())) return false;
    }
  }
  if (
    where.fireAt !== undefined &&
    !(row.fireAt.getTime() <= where.fireAt.lte.getTime())
  ) {
    return false;
  }
  return true;
}

function createPrismaStub() {
  const rows: Row[] = [];
  let nextId = 1;

  // Synchronous bodies wrapped in Promise.resolve rather than `async`: these
  // stubs have nothing to await, and an async function without an await is a
  // lint error.
  const table = {
    create: jest.fn(
      ({
        data,
      }: {
        data: { userId: string; title: string; body: string; fireAt: Date };
      }) => {
        const row: Row = {
          id: `timer-${nextId++}`,
          firedAt: null,
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return Promise.resolve(row);
      },
    ),
    findMany: jest.fn(
      ({
        where,
        take,
      }: {
        where?: Where;
        orderBy?: unknown;
        select?: unknown;
        take?: number;
      }) => {
        const found = rows
          .filter((row) => matches(row, where))
          .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
        return Promise.resolve(
          take === undefined ? found : found.slice(0, take),
        );
      },
    ),
    updateMany: jest.fn(
      ({ where, data }: { where?: Where; data: { firedAt: Date } }) => {
        let count = 0;
        for (const row of rows) {
          if (matches(row, where)) {
            row.firedAt = data.firedAt;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    ),
    deleteMany: jest.fn(({ where }: { where?: Where }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1);
          count += 1;
        }
      }
      return Promise.resolve({ count });
    }),
  };

  return {
    rows: () => rows,
    scheduledTimer: table,
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb({ scheduledTimer: table }),
    ),
  };
}

describe('ScheduledTimerService', () => {
  let service: ScheduledTimerService;
  let prisma: ReturnType<typeof createPrismaStub>;

  beforeEach(() => {
    prisma = createPrismaStub();
    service = new ScheduledTimerService(prisma as unknown as PrismaService);
  });

  describe('schedule', () => {
    it('derives the firing instant from the SERVER clock, not the client', async () => {
      // The whole reason the API takes seconds: a phone whose clock is minutes
      // off must still ring on time.
      const before = Date.now();
      const timer = await service.schedule('u-1', {
        title: 'Step 2',
        body: 'Timer finished',
        seconds: 600,
      });
      const fireAt = new Date(timer.fireAt).getTime();

      expect(fireAt).toBeGreaterThanOrEqual(before + 600_000);
      expect(fireAt).toBeLessThanOrEqual(Date.now() + 600_000);
    });

    it('returns fireAt as an ISO string the client can count down against', async () => {
      const timer = await service.schedule('u-1', {
        title: 't',
        body: 'b',
        seconds: 60,
      });
      expect(timer.fireAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(timer.id).toBeTruthy();
    });
  });

  describe('listPending', () => {
    it('returns only this user’s unfired timers', async () => {
      await service.schedule('u-1', { title: 'mine', body: 'b', seconds: 60 });
      await service.schedule('u-2', {
        title: 'theirs',
        body: 'b',
        seconds: 60,
      });

      const pending = await service.listPending('u-1');
      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe('mine');
    });

    it('omits timers that have already rung', async () => {
      await service.schedule('u-1', { title: 'rung', body: 'b', seconds: 1 });
      await service.claimDue(new Date(Date.now() + 5_000));

      expect(await service.listPending('u-1')).toEqual([]);
    });
  });

  describe('cancel', () => {
    it('removes the timer', async () => {
      const timer = await service.schedule('u-1', {
        title: 't',
        body: 'b',
        seconds: 60,
      });
      await service.cancel('u-1', timer.id);
      expect(await service.listPending('u-1')).toEqual([]);
    });

    it('refuses to cancel another user’s timer', async () => {
      const timer = await service.schedule('u-1', {
        title: 't',
        body: 'b',
        seconds: 60,
      });

      await expect(service.cancel('u-2', timer.id)).rejects.toThrow(
        NotFoundException,
      );
      // Still there — the guard must not have deleted it on the way to failing.
      expect(await service.listPending('u-1')).toHaveLength(1);
    });

    it('reports a missing timer rather than succeeding silently', async () => {
      await expect(service.cancel('u-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('claimDue', () => {
    it('returns timers that are due', async () => {
      await service.schedule('u-1', { title: 'due', body: 'b', seconds: 10 });

      const claimed = await service.claimDue(new Date(Date.now() + 11_000));
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({
        userId: 'u-1',
        title: 'due',
        body: 'b',
      });
    });

    it('leaves timers that are not yet due alone', async () => {
      await service.schedule('u-1', {
        title: 'later',
        body: 'b',
        seconds: 600,
      });
      expect(await service.claimDue(new Date())).toEqual([]);
    });

    it('never hands the same timer out twice', async () => {
      // The guarantee that stops one alarm ringing on every poll for as long as
      // the send takes.
      await service.schedule('u-1', { title: 'once', body: 'b', seconds: 10 });
      const due = new Date(Date.now() + 11_000);

      expect(await service.claimDue(due)).toHaveLength(1);
      expect(await service.claimDue(due)).toEqual([]);
    });

    it('honours the batch limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.schedule('u-1', {
          title: `t${i}`,
          body: 'b',
          seconds: 1,
        });
      }
      const claimed = await service.claimDue(new Date(Date.now() + 5_000), 2);
      expect(claimed).toHaveLength(2);
    });
  });

  describe('purgeOldFired', () => {
    it('drops rung timers past the retention window', async () => {
      await service.schedule('u-1', { title: 'old', body: 'b', seconds: 1 });
      await service.claimDue(new Date(Date.now() + 2_000));

      const purged = await service.purgeOldFired(
        new Date(Date.now() + 48 * 60 * 60 * 1000),
      );
      expect(purged).toBe(1);
      expect(prisma.rows()).toEqual([]);
    });

    it('keeps recently rung timers', async () => {
      await service.schedule('u-1', { title: 'recent', body: 'b', seconds: 1 });
      await service.claimDue(new Date(Date.now() + 2_000));

      expect(await service.purgeOldFired(new Date())).toBe(0);
      expect(prisma.rows()).toHaveLength(1);
    });

    it('never touches a pending timer', async () => {
      await service.schedule('u-1', {
        title: 'pending',
        body: 'b',
        seconds: 60,
      });

      await service.purgeOldFired(new Date(Date.now() + 48 * 60 * 60 * 1000));
      expect(await service.listPending('u-1')).toHaveLength(1);
    });
  });
});
