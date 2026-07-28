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

export function isAuthorised(headers, expected) {
  return tokenMatches(extractBearer(headers.authorization), expected);
}
