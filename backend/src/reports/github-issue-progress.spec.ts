import { GithubIssueService } from './github-issue.service';

/**
 * "Is anyone actually working on this?"
 *
 * GitHub is the tracker of record for reports, so the answer has to come from
 * there rather than from a status the app keeps and immediately disagrees with.
 * GitHub has no in-progress state, so two conventions stand in for one: an
 * assignee, or a label that says so. Supporting both means the owner does not
 * have to adopt a labelling habit for the badge to work — assigning is enough —
 * and a label works for someone who never assigns.
 *
 * It comes out of the SAME listing request as open/closed, so the answer costs
 * no extra call and cannot disagree with the state beside it.
 */
describe('GithubIssueService.states — what is being worked on', () => {
  const savedToken = process.env.ISSUE_MIRROR_TOKEN;
  const savedRepo = process.env.ISSUE_MIRROR_REPO;
  let fetchMock: jest.Mock;

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

  const listing = (rows: unknown[]) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rows),
    });
    return new GithubIssueService();
  };

  it('reads an assigned open issue as being worked on', async () => {
    const service = listing([
      {
        number: 1,
        state: 'open',
        assignees: [{ login: 'mhylle' }],
        labels: [],
      },
    ]);

    expect((await service.states()).get(1)).toBe('in_progress');
  });

  it('reads an open issue labelled in progress as being worked on', async () => {
    const service = listing([
      {
        number: 2,
        state: 'open',
        assignees: [],
        labels: [{ name: 'in progress' }],
      },
    ]);

    expect((await service.states()).get(2)).toBe('in_progress');
  });

  it('accepts the usual spellings of that label', async () => {
    const service = listing([
      {
        number: 3,
        state: 'open',
        assignees: [],
        labels: [{ name: 'In-Progress' }],
      },
      { number: 4, state: 'open', assignees: [], labels: [{ name: 'WIP' }] },
      { number: 5, state: 'open', assignees: [], labels: [{ name: 'bug' }] },
    ]);

    const states = await service.states();
    expect(states.get(3)).toBe('in_progress');
    expect(states.get(4)).toBe('in_progress');
    // A label that is not about progress must not turn one on.
    expect(states.get(5)).toBe('open');
  });

  it('leaves an untouched open issue open', async () => {
    const service = listing([
      { number: 6, state: 'open', assignees: [], labels: [] },
    ]);

    expect((await service.states()).get(6)).toBe('open');
  });

  it('keeps a closed issue closed even when it is still assigned', async () => {
    // The distractor: checking the assignee before the state reports finished
    // work as ongoing, which is the opposite of what the badge is for.
    const service = listing([
      {
        number: 7,
        state: 'closed',
        assignees: [{ login: 'mhylle' }],
        labels: [{ name: 'in progress' }],
      },
    ]);

    expect((await service.states()).get(7)).toBe('closed');
  });

  it('still ignores pull requests', async () => {
    const service = listing([
      { number: 8, state: 'open', assignees: [], labels: [], pull_request: {} },
    ]);

    expect((await service.states()).has(8)).toBe(false);
  });
});
