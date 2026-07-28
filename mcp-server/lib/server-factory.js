import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { buildResponse, buildError } from './api-client.js';
import * as recipes from '../tools/recipes.js';
import * as pantry from '../tools/pantry.js';
import * as planning from '../tools/planning.js';

const modules = [recipes, pantry, planning];

export const toolDefinitions = modules.flatMap((m) => m.definitions);
export const toolHandlers = Object.assign({}, ...modules.map((m) => m.handlers));

/**
 * Build a configured MCP server.
 *
 * Shared by both entry points so the stdio and HTTP transports can never drift
 * apart — the remote surface is the same one that was tested locally, by
 * construction rather than by discipline.
 */
export function createServer() {
  const server = new Server(
    { name: 'recipe-manager', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];
    if (!handler) {
      return buildError(new Error(`Unknown tool: ${name}`));
    }
    try {
      return buildResponse(await handler(args ?? {}));
    } catch (error) {
      // Surface failures as tool errors rather than killing the connection — a
      // bad id or an unreachable backend should be recoverable in-conversation.
      return buildError(error);
    }
  });

  return server;
}
