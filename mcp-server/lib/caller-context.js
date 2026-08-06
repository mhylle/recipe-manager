import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The credential the current MCP request arrived with.
 *
 * Carried in async-local storage rather than threaded through every tool
 * signature: tools call `api.get`/`api.post` and have no business knowing how the
 * caller authenticated. Without this, a per-user key could not reach the outbound
 * request, and every write would keep being attributed to the shared service
 * user — the exact problem personal keys exist to fix.
 *
 * One store per request, so two users' calls cannot see each other's key even
 * though they share the process.
 */
const storage = new AsyncLocalStorage();

/** Run `fn` with `mcpKey` visible to anything it calls. */
export function withCaller(mcpKey, fn) {
  return storage.run({ mcpKey }, fn);
}

/** The current caller's personal key, or null when there is none. */
export function callerKey() {
  return storage.getStore()?.mcpKey ?? null;
}
