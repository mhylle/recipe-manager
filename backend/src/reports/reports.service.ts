import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubIssueService } from './github-issue.service.js';

export type ReportKind = 'defect' | 'improvement';

export interface ReportView {
  id: string;
  kind: ReportKind;
  title: string;
  description: string;
  pagePath: string | null;
  createdAt: string;
  reporterName: string;
  /** Null when it is not on GitHub — for any reason. */
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  /** Why the mirror failed, so an unsynced report can be explained. */
  githubError: string | null;
}

/**
 * How many reports one person may file per hour.
 *
 * Generous for someone genuinely finding faults, low enough that a stuck submit
 * button or a bored child cannot fill the issue tracker. The cap is per person
 * because the row carries a reporter.
 */
const MAX_PER_HOUR = 12;

/**
 * Defects and wishes, reported from inside the app.
 *
 * Order matters and is the whole design: the row is written FIRST, then GitHub is
 * attempted. A report that reached the database but not GitHub is a mirroring
 * problem the owner can see and retry. A report that reached GitHub but not the
 * database would be a lost record with no owner. And a report lost because a
 * token expired would defeat the point of having a button at all.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubIssueService,
  ) {}

  async create(
    reporter: { id: string; displayName: string },
    input: {
      kind: ReportKind;
      title: string;
      description: string;
      pagePath?: string;
    },
  ): Promise<ReportView> {
    await this.assertUnderQuota(reporter.id);

    const report = await this.prisma.report.create({
      data: {
        kind: input.kind,
        title: input.title,
        description: input.description,
        pagePath: input.pagePath ?? null,
        reporterId: reporter.id,
      },
      include: { reporter: { select: { displayName: true } } },
    });

    // Saved. Everything below is best-effort by construction.
    const issue = await this.github.create({
      kind: input.kind,
      title: input.title,
      description: input.description,
      reporterName: reporter.displayName,
      pagePath: input.pagePath,
    });

    const mirrored = await this.prisma.report.update({
      where: { id: report.id },
      data: issue.ok
        ? {
            githubIssueNumber: issue.number,
            githubIssueUrl: issue.url,
            githubSyncedAt: new Date(),
            githubError: null,
          }
        : { githubError: issue.error },
      include: { reporter: { select: { displayName: true } } },
    });

    return this.toView(mirrored);
  }

  /** The caller's own reports, newest first. */
  async listMine(reporterId: string): Promise<ReportView[]> {
    const rows = await this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { displayName: true } } },
    });
    return rows.map((row) => this.toView(row));
  }

  /** Everything, for the owner's admin view. */
  async listAll(): Promise<ReportView[]> {
    const rows = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { displayName: true } } },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * Try the mirror again for a report that has none.
   *
   * The recovery path for the ordinary failure — a token that had expired when
   * the report came in. Without this, a report saved during an outage would stay
   * off GitHub forever and someone would have to copy it across by hand.
   */
  async retryMirror(id: string): Promise<ReportView> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { reporter: { select: { displayName: true } } },
    });
    if (!report) {
      throw new NotFoundException('No such report.');
    }
    if (report.githubIssueNumber !== null) {
      return this.toView(report);
    }

    const issue = await this.github.create({
      kind: report.kind,
      title: report.title,
      description: report.description,
      reporterName: report.reporter.displayName,
      pagePath: report.pagePath,
    });

    const updated = await this.prisma.report.update({
      where: { id },
      data: issue.ok
        ? {
            githubIssueNumber: issue.number,
            githubIssueUrl: issue.url,
            githubSyncedAt: new Date(),
            githubError: null,
          }
        : { githubError: issue.error },
      include: { reporter: { select: { displayName: true } } },
    });
    return this.toView(updated);
  }

  private async assertUnderQuota(reporterId: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.report.count({
      where: { reporterId, createdAt: { gte: since } },
    });
    if (recent >= MAX_PER_HOUR) {
      // 429 rather than 400: it is a rate limit, and a client that shows "bad
      // request" for it sends someone rewriting a perfectly good report.
      throw new HttpException(
        `That is ${String(MAX_PER_HOUR)} reports in an hour. Give it a moment before sending more.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toView(row: {
    id: string;
    kind: ReportKind;
    title: string;
    description: string;
    pagePath: string | null;
    createdAt: Date;
    githubIssueNumber: number | null;
    githubIssueUrl: string | null;
    githubError: string | null;
    reporter: { displayName: string };
  }): ReportView {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      pagePath: row.pagePath,
      createdAt: row.createdAt.toISOString(),
      reporterName: row.reporter.displayName,
      githubIssueUrl: row.githubIssueUrl,
      githubIssueNumber: row.githubIssueNumber,
      githubError: row.githubError,
    };
  }
}
