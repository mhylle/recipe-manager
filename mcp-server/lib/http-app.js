/**
 * Request handling for the HTTP transport.
 *
 * Split out of `http-server.js` so the routing and session rules can be exercised
 * by tests against a real socket, rather than only in production. The entry point
 * keeps the process concerns — reading env, listening, signals.
 */
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createServer } from './server-factory.js';
import { isAuthorised, isPersonalKey, presentedToken } from './auth.js';
import { withCaller } from './caller-context.js';

/** Bounded so a malformed or hostile client cannot buffer the process to death. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** JSON-RPC shaped error, so a client parses the failure instead of guessing. */
function rpcError(code, message) {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

/**
 * The JSON body of a POST, or undefined for methods that carry none.
 *
 * Read here rather than inside the transport because the session rules below
 * need to know whether this is an `initialize` request before choosing what to
 * do with it. The parsed value is handed on to `handleRequest`, which accepts it
 * precisely so a caller can pre-read the stream.
 */
async function readJsonBody(req) {
  if (req.method !== 'POST') {
    return undefined;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length === 0 ? undefined : JSON.parse(raw);
}

/**
 * Build the request handler.
 *
 * `token` is the shared service token; a personal `rmk_` key is accepted too and
 * forwarded to the backend, which is the only thing that can validate it.
 */
export function createRequestHandler({ token, mcpPath = '/mcp' }) {
  /** Live sessions, keyed by the id the transport hands out. */
  const sessions = new Map();

  return async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    // Unauthenticated liveness probe. Deliberately says nothing about the service
    // beyond "the process is up" — no version, no tool list, no session count.
    if (url.pathname === '/health') {
      return send(res, 200, { status: 'ok' });
    }

    if (url.pathname !== mcpPath) {
      return send(res, 404, { error: 'Not found' });
    }

    if (!isAuthorised(req.headers, token)) {
      // WWW-Authenticate tells a well-behaved client how to retry; the body says
      // nothing that would help someone guess the token.
      res.setHeader('WWW-Authenticate', 'Bearer realm="recipe-manager-mcp"');
      return send(res, 401, { error: 'Unauthorized' });
    }

    // Only a personal key travels onward; the shared token stays an env concern.
    const presented = presentedToken(req.headers);
    const personalKey = isPersonalKey(presented) ? presented : null;

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return send(res, 400, rpcError(-32700, 'Parse error: body is not valid JSON'));
    }

    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;

      if (!transport) {
        // A session id we have never heard of. The usual cause is a restart:
        // sessions live in this process's memory and hold open SSE streams, so
        // they cannot outlive it — after a deploy every connected client is
        // holding an id that no longer exists.
        //
        // 404 is what the Streamable HTTP spec defines for this, and a client
        // that receives it opens a new session by re-sending `initialize`.
        // Falling through to a fresh, un-initialized transport instead answers
        // "Server not initialized" (400) to this request and every later one,
        // which strands the client until a human restarts Claude Desktop.
        if (typeof sessionId === 'string' && sessionId.length > 0) {
          return send(
            res,
            404,
            rpcError(-32001, 'Session not found — send initialize to start a new one'),
          );
        }

        // No session and not an opening request: creating a transport here would
        // produce a session the client never asked for and cannot use.
        if (!isInitializeRequest(body)) {
          return send(
            res,
            400,
            rpcError(-32000, 'Bad Request: no session id, and this is not an initialize request'),
          );
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => sessions.set(id, transport),
        });
        // Drop the session when the client goes away, so a long-lived process does
        // not accumulate dead transports.
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };
        await createServer().connect(transport);
      }

      // Wrapped so every outbound API call this request makes carries the same
      // caller's key, without any tool needing to know it exists.
      await withCaller(personalKey, () => transport.handleRequest(req, res, body));
    } catch (error) {
      console.error('MCP request failed:', error);
      if (!res.headersSent) {
        send(res, 500, { error: 'Internal error' });
      }
    }
  };
}
