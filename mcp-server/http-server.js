#!/usr/bin/env node
/**
 * Recipe Manager MCP server — HTTP transport.
 *
 * The same tool surface as the stdio entry point, served over Streamable HTTP so
 * Claude Desktop can reach it from anywhere instead of only when the dev machine
 * is on. Runs behind nginx on mhylle.com.
 *
 * Every MCP request must carry `Authorization: Bearer <token>`. The tools can
 * delete recipes and this endpoint is public, so there is no unauthenticated
 * mode — the process refuses to start without a token configured.
 */
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createServer } from './lib/server-factory.js';
import { isAuthorised, isPersonalKey, presentedToken, requireToken } from './lib/auth.js';
import { withCaller } from './lib/caller-context.js';
import { getApiBase } from './lib/api-client.js';

const PORT = Number(process.env.PORT || 3100);
const MCP_PATH = process.env.RECIPE_MANAGER_MCP_PATH || '/mcp';
const token = requireToken();

/** Sessions, keyed by the id the transport hands out. */
const sessions = new Map();

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  // Unauthenticated liveness probe. Deliberately says nothing about the service
  // beyond "the process is up" — no version, no tool list, no session count.
  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  if (url.pathname !== MCP_PATH) {
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

  try {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? sessions.get(sessionId) : undefined;

    if (!transport) {
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
    await withCaller(personalKey, () => transport.handleRequest(req, res));
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) {
      send(res, 500, { error: 'Internal error' });
    }
  }
});

httpServer.listen(PORT, () => {
  console.error(
    `recipe-manager MCP (http) listening on :${PORT}${MCP_PATH} → API ${getApiBase()}`,
  );
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    httpServer.close(() => process.exit(0));
  });
}
