import { Injectable, Logger } from '@nestjs/common';

export interface IssueInput {
  kind: 'defect' | 'improvement';
  title: string;
  description: string;
  reporterName: string;
  pagePath?: string | null;
}

export type IssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; error: string };

/** How long to wait on GitHub before giving up and saving without a mirror. */
const TIMEOUT_MS = 10_000;

/** Issue states are decoration on a list; a minute stale is fine. */
const STATE_CACHE_MS = 60_000;

/** Bounded so a large tracker cannot turn one page load into many requests. */
const STATE_MAX_PAGES = 3;

/**
 * Where a report stands, as GitHub sees it.
 *
 * `in_progress` is ours: GitHub has no such state, so it is inferred from an
 * assignee or a label. It replaces `open` rather than sitting beside it, so
 * "closed and still assigned" cannot be represented — that combination is
 * finished work, and reporting it as ongoing is the opposite of the point.
 */
export type IssueState = 'open' | 'in_progress' | 'closed';

/** The label spellings that mean somebody has picked this up. */
const IN_PROGRESS_LABEL = /^(in[-\s]?progress|wip|doing)$/i;

/**
 * Where one issue stands.
 *
 * Closed is decided first and alone. An issue that was assigned and then
 * finished still carries the assignee, so reading that first would report every
 * completed report as ongoing.
 */
function stateOf(row: {
  state?: string;
  assignees?: { login?: string }[];
  labels?: ({ name?: string } | string)[];
}): IssueState {
  if (row.state === 'closed') return 'closed';

  const assigned = (row.assignees ?? []).length > 0;
  const labelled = (row.labels ?? []).some((label) =>
    IN_PROGRESS_LABEL.test(
      typeof label === 'string' ? label : (label.name ?? ''),
    ),
  );
  return assigned || labelled ? 'in_progress' : 'open';
}

/**
 * Mirrors a report onto GitHub.
 *
 * Deliberately knows nothing about the database. The report is already saved by
 * the time this runs, so every failure here is recoverable and none of them may
 * throw into the caller's face — a family member reporting a bug should never see
 * "500" because a personal access token expired.
 *
 * Unconfigured is a normal state, not an error: without a token the app still
 * collects reports, and the owner reads them in the app instead.
 */
@Injectable()
export class GithubIssueService {
  private readonly logger = new Logger(GithubIssueService.name);

  /**
   * Named without a GITHUB_ prefix on purpose.
   *
   * GitHub reserves that prefix: `gh secret set GITHUB_ISSUE_TOKEN` is rejected
   * with "Secret names must not start with GITHUB_", so the first version of this
   * could never have been configured at all.
   */
  private readonly token = process.env.ISSUE_MIRROR_TOKEN?.trim() ?? '';
  /** owner/repo. Defaults to this app's own repository. */
  private readonly repo =
    process.env.ISSUE_MIRROR_REPO?.trim() ?? 'mhylle/recipe-manager';

  private statesCache = new Map<number, IssueState>();
  private statesFetchedAt = 0;

  get configured(): boolean {
    return this.token.length > 0 && this.repo.includes('/');
  }

  /**
   * Compose the issue body.
   *
   * The reporter's text goes inside a fenced block. Without that, someone could
   * type a line that looks like our own attribution footer and make a report
   * appear to come from somebody else — cheap to prevent, and impossible to
   * unpick afterwards. Fencing also stops a stray heading rearranging the issue.
   */
  private body(input: IssueInput): string {
    // A fence longer than any run of backticks in the text cannot be closed early.
    const longestRun = /`+/g
      .exec(input.description)
      ?.reduce(
        (longest, run) => (run.length > longest ? run.length : longest),
        0,
      );
    const fence = '`'.repeat(Math.max(3, (longestRun ?? 0) + 1));

    return [
      `**Reported by:** ${input.reporterName}`,
      input.pagePath ? `**On page:** \`${input.pagePath}\`` : null,
      '',
      '### What they said',
      '',
      fence,
      input.description,
      fence,
      '',
      '<sub>Filed from the in-app report button.</sub>',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  /**
   * Current open/closed state for mirrored issues, keyed by number.
   *
   * One listing request rather than one per report: with a few dozen reports the
   * per-report version would spend a request each and hit the rate limit for no
   * benefit. Numbers not found come back absent, and the caller shows "unknown"
   * rather than guessing — an issue can always be older than the pages we read.
   *
   * Cached briefly. This is decoration on a list view; a state that is a minute
   * stale is not worth a request on every page load.
   */
  async states(): Promise<Map<number, IssueState>> {
    if (!this.configured) return new Map();

    const fresh = Date.now() - this.statesFetchedAt < STATE_CACHE_MS;
    if (fresh && this.statesCache.size > 0) {
      return this.statesCache;
    }

    const found = new Map<number, IssueState>();
    try {
      for (let page = 1; page <= STATE_MAX_PAGES; page++) {
        const url = new URL(`https://api.github.com/repos/${this.repo}/issues`);
        url.searchParams.set('state', 'all');
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) break;

        const rows = (await response.json()) as {
          number?: number;
          state?: string;
          pull_request?: unknown;
          assignees?: { login?: string }[];
          labels?: ({ name?: string } | string)[];
        }[];
        if (!Array.isArray(rows) || rows.length === 0) break;

        for (const row of rows) {
          // Pull requests share the issue numbering space and come back from this
          // endpoint too. A report never refers to one, so skipping them keeps the
          // map to what it claims to hold.
          if (row.pull_request !== undefined) continue;
          if (typeof row.number !== 'number') continue;
          found.set(row.number, stateOf(row));
        }
        if (rows.length < 100) break;
      }
    } catch (error) {
      // Same rule as create(): a decoration failing must not fail the list.
      this.logger.warn(
        `Could not read issue states: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Serve whatever the previous fetch found rather than nothing.
      return this.statesCache;
    }

    this.statesCache = found;
    this.statesFetchedAt = Date.now();
    return found;
  }

  async create(input: IssueInput): Promise<IssueResult> {
    if (!this.configured) {
      return { ok: false, error: 'GitHub mirroring is not configured.' };
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: input.title,
            body: this.body(input),
            labels: [input.kind === 'defect' ? 'bug' : 'enhancement'],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        // Report the status, not the body: a 401 body from GitHub is noise, and
        // an error string is stored on the row and shown to the owner.
        const error = `GitHub responded ${String(response.status)}`;
        this.logger.warn(`Could not mirror report: ${error}`);
        return { ok: false, error };
      }

      const issue = (await response.json()) as {
        number?: number;
        html_url?: string;
      };
      if (
        typeof issue.number !== 'number' ||
        typeof issue.html_url !== 'string'
      ) {
        return { ok: false, error: 'GitHub returned an unexpected response.' };
      }
      return { ok: true, number: issue.number, url: issue.html_url };
    } catch (error) {
      // Timeout, DNS, TLS — all the same to the caller, and none of them may
      // reach the person who just reported a bug.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not mirror report: ${message}`);
      return { ok: false, error: message.slice(0, 200) };
    }
  }
}
