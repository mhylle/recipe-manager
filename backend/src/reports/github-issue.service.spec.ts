import { GithubIssueService } from './github-issue.service';

const INPUT = {
  kind: 'defect' as const,
  title: 'Timers do not ring',
  description: 'Locked the phone and nothing happened.',
  reporterName: 'A Cook',
  pagePath: '/recipes/abc',
};

describe('GithubIssueService', () => {
  const savedToken = process.env.ISSUE_MIRROR_TOKEN;
  const savedRepo = process.env.ISSUE_MIRROR_REPO;
  let fetchMock: jest.Mock;

  /** The JSON body of one outbound call, typed rather than reached into. */
  const sentBody = (
    call = 0,
  ): { title: string; body: string; labels: string[] } => {
    const args = fetchMock.mock.calls[call] as [string, { body: string }];
    return JSON.parse(args[1].body) as {
      title: string;
      body: string;
      labels: string[];
    };
  };

  beforeEach(() => {
    process.env.ISSUE_MIRROR_TOKEN = 'ghp_test_token_value';
    process.env.ISSUE_MIRROR_REPO = 'mhylle/recipe-manager';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (savedToken === undefined) delete process.env.ISSUE_MIRROR_TOKEN;
    else process.env.ISSUE_MIRROR_TOKEN = savedToken;
    if (savedRepo === undefined) delete process.env.ISSUE_MIRROR_REPO;
    else process.env.ISSUE_MIRROR_REPO = savedRepo;
    jest.restoreAllMocks();
  });

  const ok = (body: unknown) => ({
    ok: true,
    json: () => Promise.resolve(body),
  });

  it('creates an issue and returns its number and url', async () => {
    fetchMock.mockResolvedValue(
      ok({
        number: 42,
        html_url: 'https://github.com/mhylle/recipe-manager/issues/42',
      }),
    );
    const service = new GithubIssueService();

    const result = await service.create(INPUT);

    expect(result).toEqual({
      ok: true,
      number: 42,
      url: 'https://github.com/mhylle/recipe-manager/issues/42',
    });
  });

  it('labels a defect as a bug and an improvement as an enhancement', async () => {
    fetchMock.mockResolvedValue(ok({ number: 1, html_url: 'u' }));
    const service = new GithubIssueService();

    await service.create(INPUT);
    await service.create({ ...INPUT, kind: 'improvement' });

    expect(sentBody(0).labels).toEqual(['bug']);
    expect(sentBody(1).labels).toEqual(['enhancement']);
  });

  describe('the issue body', () => {
    const bodyOf = async (description: string): Promise<string> => {
      fetchMock.mockResolvedValue(ok({ number: 1, html_url: 'u' }));
      await new GithubIssueService().create({ ...INPUT, description });
      return sentBody(fetchMock.mock.calls.length - 1).body;
    };

    it('attributes the report and names the page', async () => {
      const body = await bodyOf('Nothing happened.');
      expect(body).toContain('**Reported by:** A Cook');
      expect(body).toContain('/recipes/abc');
    });

    it('fences the reporter’s text', async () => {
      // Otherwise a reporter could type a line that looks like our attribution
      // footer and make a report appear to come from somebody else.
      const body = await bodyOf('**Reported by:** Somebody Important');
      const fenced = body.split('```')[1] ?? '';
      expect(fenced).toContain('**Reported by:** Somebody Important');
      // Ours is still the first, outside the fence.
      expect(body.indexOf('**Reported by:** A Cook')).toBeLessThan(
        body.indexOf('**Reported by:** Somebody Important'),
      );
    });

    it('cannot have its fence closed early by backticks in the text', async () => {
      const body = await bodyOf('Here is a fence: ``` and more text after it.');
      // A longer fence than any run inside keeps the whole quote contained.
      expect(body).toContain('````');
      expect(body).toContain('and more text after it.');
    });
  });

  describe('failing safely', () => {
    it('reports being unconfigured rather than throwing', async () => {
      delete process.env.ISSUE_MIRROR_TOKEN;
      const service = new GithubIssueService();

      expect(service.configured).toBe(false);
      await expect(service.create(INPUT)).resolves.toEqual({
        ok: false,
        error: 'GitHub mirroring is not configured.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('turns a non-2xx into a result, not an exception', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });
      const service = new GithubIssueService();

      await expect(service.create(INPUT)).resolves.toEqual({
        ok: false,
        error: 'GitHub responded 401',
      });
    });

    it('turns a network failure into a result', async () => {
      // A family member reporting a bug must never see a 500 because DNS failed.
      fetchMock.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND api.github.com'),
      );
      const service = new GithubIssueService();

      const result = await service.create(INPUT);
      expect(result.ok).toBe(false);
    });

    it('rejects a response that is missing the fields we need', async () => {
      fetchMock.mockResolvedValue(ok({ message: 'something else entirely' }));
      const service = new GithubIssueService();

      await expect(service.create(INPUT)).resolves.toMatchObject({ ok: false });
    });
  });
});
