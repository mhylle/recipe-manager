/**
 * Shared HTTP client for the Recipe Manager API.
 *
 * Tool modules use {get, post, patch, del} and never deal with URLs, headers or
 * error shapes. Uses the built-in fetch (Node 20+), so the server has exactly one
 * runtime dependency: the MCP SDK itself.
 *
 * Reads are public. Writes require a credential, so every request carries the
 * service token when one is configured — see requestHeaders() below.
 */

const DEFAULT_API_BASE = 'https://mhylle.com/api/recipe-manager/api';

/** Locales the backend stores content in. Keep in sync with backend/src/shared/i18n. */
export const SUPPORTED_LOCALES = ['en', 'da'];

const BCP47 = { en: 'en-US', da: 'da-DK' };

/**
 * Read env on every call rather than caching, so a parent process that sets the
 * variable after import still works.
 */
export function getApiBase() {
  return (process.env.RECIPE_MANAGER_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/**
 * Content language for a request.
 *
 * The backend serves recipe and pantry text per locale and falls back to the
 * row's source language, so an unknown value degrades to readable text rather
 * than failing. Defaults to the RECIPE_MANAGER_LOCALE env var, then English.
 */
function acceptLanguage(locale) {
  const wanted = locale || process.env.RECIPE_MANAGER_LOCALE || 'en';
  return BCP47[wanted] || BCP47.en;
}

/**
 * Headers for an API call.
 *
 * The backend guards every write behind the shared SSO session or a
 * recipe-manager-scoped service token. The MCP server has no browser session, so
 * it presents the service token. Sent on reads too — harmless, since the guard
 * only runs on guarded routes, and it means a read and a write cannot end up
 * authenticated differently.
 *
 * Absent token is not an error here: a local stdio server pointed at a dev
 * backend has nothing to authenticate against, and reads still work. Writes will
 * fail with the backend's own 401, which says more than a guess would.
 */
function requestHeaders(locale) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': acceptLanguage(locale),
  };
  const serviceToken = process.env.RECIPE_MANAGER_SERVICE_TOKEN;
  if (serviceToken) {
    headers['X-Service-Token'] = serviceToken;
  }
  return headers;
}

async function request(method, path, { body, locale, query } = {}) {
  const url = new URL(getApiBase() + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders(locale),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    // Network-level failure: no response at all. Name the base URL, because the
    // usual cause is RECIPE_MANAGER_API_URL pointing somewhere that isn't running.
    throw new Error(
      `Could not reach the Recipe Manager API at ${getApiBase()} — ${cause.message}`,
    );
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = payload?.message || payload?.error || response.statusText;
    throw new Error(`${method} ${path} failed (HTTP ${response.status}): ${detail}`);
  }
  return payload;
}

/**
 * Every page of a paginated list endpoint, concatenated.
 *
 * The API answers lists as `{ data, meta }`. Returning only the first page would
 * quietly drop everything past the default limit, and an assistant asked to
 * "list my recipes" would confidently report an incomplete set — the worst kind
 * of wrong, because nothing errors.
 */
async function getAllPages(path, opts = {}) {
  const all = [];
  let offset = 0;

  for (;;) {
    const page = await request('GET', path, {
      ...opts,
      query: { ...(opts.query || {}), offset },
    });
    // Tolerate a non-paginated response, so this helper is safe to point at an
    // endpoint that has not been migrated yet.
    if (Array.isArray(page)) return page;

    all.push(...page.data);
    offset += page.data.length;
    if (page.data.length === 0 || !page.meta?.hasMore) return all;
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  getAll: (path, opts) => getAllPages(path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
};

/** Wrap a value as MCP tool content. Objects are pretty-printed for readability. */
export function buildResponse(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function buildError(error) {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

/** Shared schema fragment — every read tool accepts a language. */
export const localeProperty = {
  locale: {
    type: 'string',
    enum: SUPPORTED_LOCALES,
    description:
      "Language for recipe and pantry text ('en' or 'da'). Defaults to RECIPE_MANAGER_LOCALE, then English. Missing translations fall back to the recipe's source language rather than coming back blank.",
  },
};
