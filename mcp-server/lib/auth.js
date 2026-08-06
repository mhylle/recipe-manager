import { timingSafeEqual } from 'node:crypto';

/**
 * Bearer-token gate for the remote transport.
 *
 * The stdio server needs none of this — it is a local child process the user
 * already controls. The HTTP one is on the public internet with tools that can
 * delete recipes, so the token is a hard requirement rather than a nicety.
 */

/** The server refuses to start without this, rather than defaulting to open. */
export function requireToken() {
  const token = process.env.RECIPE_MANAGER_MCP_TOKEN;
  if (!token || token.length < 32) {
    throw new Error(
      'RECIPE_MANAGER_MCP_TOKEN must be set to a secret of at least 32 characters. ' +
        'Refusing to start an unauthenticated MCP server on a public endpoint.',
    );
  }
  return token;
}

/**
 * Constant-time comparison. A plain `===` leaks the token a character at a time
 * through response timing, which matters precisely because this endpoint is
 * reachable by anyone who wants to sit and measure it.
 */
export function tokenMatches(presented, expected) {
  if (typeof presented !== 'string' || presented.length === 0) {
    return false;
  }
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  // Hash-free equalisation: compare against a padded copy and AND in the length
  // check, so every path does the same work.
  const sameLength = a.length === b.length;
  const left = sameLength ? a : Buffer.alloc(b.length);
  return timingSafeEqual(left, b) && sameLength;
}

/** Pull the bearer value out of an Authorization header. */
export function extractBearer(headerValue) {
  if (typeof headerValue !== 'string') {
    return null;
  }
  const match = /^Bearer[ ]+(.+)$/i.exec(headerValue.trim());
  return match ? match[1].trim() : null;
}

/**
 * The credential the caller presented, from either accepted header.
 *
 * `Authorization: Bearer <token>` is the standard and what a spec-compliant
 * client sends. `X-MCP-Token: <token>` exists because the bearer scheme requires
 * a space, and on Windows the stdio bridge is launched through `npx.cmd`, which
 * cmd.exe re-parses — an argument containing a space can arrive split in two and
 * the header is silently dropped. A space-free header sidesteps that entirely.
 */
export function presentedToken(headers) {
  const bearer = extractBearer(headers.authorization);
  if (bearer) {
    return bearer;
  }
  const direct = headers['x-mcp-token'];
  return typeof direct === 'string' && direct.trim().length > 0 ? direct.trim() : null;
}

/**
 * The prefix every personal key carries. Kept in step with McpKeyService on the
 * backend, which mints them.
 */
const PERSONAL_KEY_PREFIX = 'rmk_';

/** Whether a presented credential looks like somebody's own key. */
export function isPersonalKey(value) {
  return typeof value === 'string' && value.startsWith(PERSONAL_KEY_PREFIX);
}

/**
 * Whether this request may proceed.
 *
 * Two accepted credentials, and they are different things:
 *
 * 1. **A personal key** (`rmk_…`) — forwarded to the backend, which is the only
 *    thing that can say whether it is real, whose it is, and whether it has been
 *    revoked. Accepting it here on shape alone is deliberate: this process holds
 *    no key material, and a write with a bogus key gets a 401 from the API. Reads
 *    are public anyway, so nothing is exposed by being permissive at this hop.
 * 2. **The shared service token** — the pre-existing path, still accepted so a
 *    Desktop config that predates personal keys keeps working.
 */
export function isAuthorised(headers, expected) {
  const presented = presentedToken(headers);
  if (isPersonalKey(presented)) {
    return true;
  }
  return tokenMatches(presented, expected);
}
