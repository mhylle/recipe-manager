import { HttpStatus, HttpException, NotFoundException } from '@nestjs/common';
import { ReportsService, type ReportKind } from './reports.service';
import { GithubIssueService, type IssueResult } from './github-issue.service';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  kind: ReportKind;
  title: string;
  description: string;
  pagePath: string | null;
  reporterId: string;
  createdAt: Date;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  githubSyncedAt: Date | null;
  githubError: string | null;
}

function createPrismaStub() {
  const rows: Row[] = [];
  let next = 1;
  const withReporter = (row: Row) => ({
    ...row,
    reporter: {
      displayName: row.reporterId === 'u-1' ? 'A Cook' : 'Someone Else',
    },
  });

  return {
    rows: () => rows,
    report: {
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<
            Row,
            | 'id'
            | 'createdAt'
            | 'githubIssueNumber'
            | 'githubIssueUrl'
            | 'githubSyncedAt'
            | 'githubError'
          >;
        }) => {
          const row: Row = {
            id: `r-${next++}`,
            createdAt: new Date(),
            githubIssueNumber: null,
            githubIssueUrl: null,
            githubSyncedAt: null,
            githubError: null,
            ...data,
          };
          rows.push(row);
          return Promise.resolve(withReporter(row));
        },
      ),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) return Promise.reject(new Error('no such row'));
          Object.assign(row, data);
          return Promise.resolve(withReporter(row));
        },
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return Promise.resolve(row ? withReporter(row) : null);
      }),
      findMany: jest.fn(({ where }: { where?: { reporterId?: string } }) =>
        Promise.resolve(
          rows
            .filter(
              (r) => !where?.reporterId || r.reporterId === where.reporterId,
            )
            .map(withReporter),
        ),
      ),
      count: jest.fn(({ where }: { where: { reporterId: string } }) =>
        Promise.resolve(
          rows.filter((r) => r.reporterId === where.reporterId).length,
        ),
      ),
    },
  };
}

interface GithubStub {
  configured: boolean;
  calls: unknown[];
  result: IssueResult;
  create: jest.Mock;
}

/**
 * Holds its state internally rather than reaching for the outer `stub`, which
 * made the factory's return type reference itself.
 */
function createGithubStub(
  result: IssueResult = {
    ok: true,
    number: 42,
    url: 'https://github.com/x/y/issues/42',
  },
): GithubStub {
  const state = { result, calls: [] as unknown[] };
  return {
    configured: true,
    get calls() {
      return state.calls;
    },
    get result() {
      return state.result;
    },
    set result(value: IssueResult) {
      state.result = value;
    },
    create: jest.fn((input: unknown) => {
      state.calls.push(input);
      return Promise.resolve(state.result);
    }),
  };
}

let stub: GithubStub;

const REPORTER = { id: 'u-1', displayName: 'A Cook' };
const INPUT = {
  kind: 'defect' as ReportKind,
  title: 'Timers do not ring',
  description: 'Locked the phone and nothing happened.',
  pagePath: '/recipes/abc',
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof createPrismaStub>;

  const build = (issue?: IssueResult) => {
    prisma = createPrismaStub();
    stub = createGithubStub(issue);
    service = new ReportsService(
      prisma as unknown as PrismaService,
      stub as unknown as GithubIssueService,
    );
  };

  beforeEach(() => build());

  describe('create', () => {
    it('saves the report and records the mirrored issue', async () => {
      const view = await service.create(REPORTER, INPUT);

      expect(view.title).toBe('Timers do not ring');
      expect(view.githubIssueNumber).toBe(42);
      expect(view.githubIssueUrl).toBe('https://github.com/x/y/issues/42');
      expect(view.githubError).toBeNull();
    });

    it('SAVES THE REPORT even when GitHub fails', async () => {
      // The guarantee the whole design exists for: a report must never be lost
      // because a token expired or the API was unreachable.
      build({ ok: false, error: 'GitHub responded 401' });

      const view = await service.create(REPORTER, INPUT);

      expect(prisma.rows()).toHaveLength(1);
      expect(view.id).toBeTruthy();
      expect(view.githubIssueNumber).toBeNull();
      // And says why, so an unsynced report is explainable rather than looking
      // like nobody cared.
      expect(view.githubError).toBe('GitHub responded 401');
    });

    it('writes the row BEFORE attempting the mirror', async () => {
      // Order is the design. If GitHub were called first, a crash between the two
      // would leave an issue nobody owns.
      build({ ok: false, error: 'timeout' });
      await service.create(REPORTER, INPUT);

      expect(prisma.report.create).toHaveBeenCalled();
      const createOrder = prisma.report.create.mock.invocationCallOrder[0];
      const mirrorOrder = stub.create.mock.invocationCallOrder[0];
      expect(createOrder).toBeLessThan(mirrorOrder);
    });

    it('passes the reporter’s name and page to the mirror', async () => {
      await service.create(REPORTER, INPUT);

      expect(stub.calls[0]).toMatchObject({
        kind: 'defect',
        reporterName: 'A Cook',
        pagePath: '/recipes/abc',
      });
    });

    it('accepts a report with no page path', async () => {
      const view = await service.create(REPORTER, {
        kind: 'improvement',
        title: 'Wish: shopping list sorting',
        description: 'By aisle would be nice.',
      });
      expect(view.pagePath).toBeNull();
      expect(view.kind).toBe('improvement');
    });
  });

  describe('rate limiting', () => {
    it('refuses a thirteenth report in an hour, with 429', async () => {
      for (let i = 0; i < 12; i++) {
        await service.create(REPORTER, {
          ...INPUT,
          title: `Report ${String(i)}`,
        });
      }

      await expect(service.create(REPORTER, INPUT)).rejects.toThrow(
        HttpException,
      );
      // 400 would send someone rewriting a perfectly good report.
      await expect(service.create(REPORTER, INPUT)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('counts per person, not globally', async () => {
      for (let i = 0; i < 12; i++) {
        await service.create(REPORTER, {
          ...INPUT,
          title: `Report ${String(i)}`,
        });
      }
      // Somebody else is unaffected by their neighbour's enthusiasm.
      await expect(
        service.create({ id: 'u-2', displayName: 'Someone Else' }, INPUT),
      ).resolves.toBeTruthy();
    });
  });

  describe('listing', () => {
    it('shows only the caller’s own reports', async () => {
      await service.create(REPORTER, INPUT);
      await service.create({ id: 'u-2', displayName: 'Someone Else' }, INPUT);

      expect(await service.listMine('u-1')).toHaveLength(1);
      expect(await service.listAll()).toHaveLength(2);
    });
  });

  describe('retryMirror', () => {
    it('mirrors a report that had failed', async () => {
      build({ ok: false, error: 'GitHub responded 401' });
      const created = await service.create(REPORTER, INPUT);
      expect(created.githubIssueNumber).toBeNull();

      // Token fixed since.
      stub.result = {
        ok: true,
        number: 7,
        url: 'https://github.com/x/y/issues/7',
      };
      const retried = await service.retryMirror(created.id);

      expect(retried.githubIssueNumber).toBe(7);
      expect(retried.githubError).toBeNull();
    });

    it('does not create a second issue for an already-mirrored report', async () => {
      const created = await service.create(REPORTER, INPUT);
      stub.create.mockClear();

      const again = await service.retryMirror(created.id);

      expect(stub.create).not.toHaveBeenCalled();
      expect(again.githubIssueNumber).toBe(42);
    });

    it('reports an unknown id as not found', async () => {
      await expect(service.retryMirror('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
