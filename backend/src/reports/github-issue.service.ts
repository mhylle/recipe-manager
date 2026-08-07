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
