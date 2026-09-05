#!/usr/bin/env node
/**
 * Recipe Manager MCP server — HTTP transport.
 *
 * The same tool surface as the stdio entry point, served over Streamable HTTP so
 * Claude Desktop can reach it from anywhere instead of only when the dev machine
 * is on. Runs behind nginx on mhylle.com.
 *
 * Every MCP request must carry a credential — `Authorization: Bearer <token>`,
 * `X-MCP-Token: <token>`, or a personal `rmk_` key. The tools can delete recipes
 * and this endpoint is public, so there is no unauthenticated mode: the process
 * refuses to start without a token configured.
 *
 * Request handling lives in `lib/http-app.js` so it can be tested against a real
 * socket; this file is only the process — env, listening, signals.
 */
import { createServer as createHttpServer } from 'node:http';

import { createRequestHandler } from './lib/http-app.js';
import { requireToken } from './lib/auth.js';
import { getApiBase } from './lib/api-client.js';

const PORT = Number(process.env.PORT || 3100);
const MCP_PATH = process.env.RECIPE_MANAGER_MCP_PATH || '/mcp';
const token = requireToken();

const httpServer = createHttpServer(createRequestHandler({ token, mcpPath: MCP_PATH }));

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
