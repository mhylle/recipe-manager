/**
 * Shared pagination shape.
 *
 * Every list endpoint answers with `{ data, meta }` so a caller never has to
 * guess whether it received everything or just the first slice — the previous
 * bare-array response made "49 recipes" and "the first 49 of 200" identical on
 * the wire.
 */

export interface PageRequest {
  limit?: number;
  offset?: number;
}

export interface Paged<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
  /** Whether another page exists — saves every caller recomputing it. */
  hasMore: boolean;
}

export interface PagedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export const DEFAULT_PAGE_LIMIT = 100;

/**
 * The largest page a caller may ask for.
 *
 * Not a limit on what the system can hold — it is the point past which a single
 * response stops being useful and starts being a way to pull the whole table in
 * one request. A caller that genuinely wants everything pages through it.
 */
export const MAX_PAGE_LIMIT = 500;

/** Clamp caller-supplied paging into something the database can be asked for. */
export function normalisePageRequest(page: PageRequest): { limit: number; offset: number } {
  const rawLimit = Number(page.limit);
  const rawOffset = Number(page.offset);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT;

  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

/** Wrap a repository result as the response envelope. */
export function toPagedResponse<T>(paged: Paged<T>): PagedResponse<T> {
  return {
    data: paged.data,
    meta: {
      total: paged.total,
      limit: paged.limit,
      offset: paged.offset,
      hasMore: paged.offset + paged.data.length < paged.total,
    },
  };
}
