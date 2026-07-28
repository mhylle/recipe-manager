/**
 * Shared HTTP client for the Recipe Manager API.
 *
 * Tool modules use {get, post, patch, del} and never deal with URLs, headers or
 * error shapes. Uses the built-in fetch (Node 20+), so the server has exactly one
 * runtime dependency: the MCP SDK itself.
 *
 * The API is unauthenticated — recipe-manager has no login — so there is no token
 * handling here. If that ever changes, this is the one place to add it.
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

async function request(method, path, { body, locale, query } = {}) {
  const url = new URL(getApiBase() + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': acceptLanguage(locale),
      },
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

export const api = {
  get: (path, opts) => request('GET', path, opts),
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
