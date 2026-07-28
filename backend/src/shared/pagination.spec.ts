import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  normalisePageRequest,
  toPagedResponse,
} from './pagination.js';

describe('normalisePageRequest', () => {
  it('defaults when nothing is supplied', () => {
    expect(normalisePageRequest({})).toEqual({ limit: DEFAULT_PAGE_LIMIT, offset: 0 });
  });

  it('honours a sensible request', () => {
    expect(normalisePageRequest({ limit: 20, offset: 40 })).toEqual({ limit: 20, offset: 40 });
  });

  it('caps an oversized limit rather than letting one request pull the table', () => {
    expect(normalisePageRequest({ limit: 10_000 }).limit).toBe(MAX_PAGE_LIMIT);
  });

  it('rejects a zero or negative limit instead of asking Postgres for LIMIT 0', () => {
    // take: 0 returns nothing, which would look like an empty database.
    expect(normalisePageRequest({ limit: 0 }).limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(normalisePageRequest({ limit: -5 }).limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('clamps a negative offset to zero', () => {
    // A negative skip is a Prisma runtime error, not a silent no-op.
    expect(normalisePageRequest({ offset: -10 }).offset).toBe(0);
  });

  it('survives garbage from the query string', () => {
    expect(normalisePageRequest({ limit: NaN, offset: NaN })).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
    });
    expect(normalisePageRequest({ limit: Infinity }).limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('floors a fractional page request', () => {
    expect(normalisePageRequest({ limit: 10.9, offset: 5.9 })).toEqual({ limit: 10, offset: 5 });
  });
});

describe('toPagedResponse', () => {
  it('reports hasMore when the page does not reach the total', () => {
    const response = toPagedResponse({ data: [1, 2], total: 10, limit: 2, offset: 0 });
    expect(response.meta).toEqual({ total: 10, limit: 2, offset: 0, hasMore: true });
  });

  it('reports hasMore false on the last page', () => {
    const response = toPagedResponse({ data: [9, 10], total: 10, limit: 2, offset: 8 });
    expect(response.meta.hasMore).toBe(false);
  });

  it('reports hasMore false when everything fits in one page', () => {
    expect(toPagedResponse({ data: [1], total: 1, limit: 100, offset: 0 }).meta.hasMore).toBe(false);
  });

  it('reports hasMore false for an empty result', () => {
    // An empty page with hasMore true would send a caller looping forever.
    expect(toPagedResponse({ data: [], total: 0, limit: 100, offset: 0 }).meta.hasMore).toBe(false);
  });

  it('reports hasMore false for an offset past the end', () => {
    expect(toPagedResponse({ data: [], total: 5, limit: 10, offset: 50 }).meta.hasMore).toBe(false);
  });

  it('passes the data through untouched', () => {
    const data = [{ id: 'a' }];
    expect(toPagedResponse({ data, total: 1, limit: 100, offset: 0 }).data).toBe(data);
  });
});
