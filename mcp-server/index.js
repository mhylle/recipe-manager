#!/usr/bin/env node
/**
 * Recipe Manager MCP server.
 *
 * Exposes The Atelier Kitchen — recipes, pantry, meal plans and shopping lists —
 * to Claude Desktop over stdio.
 *
 * Deliberately does NOT expose the BilkaToGo integration. Those endpoints log
 * into a real Salling Group account and put groceries in a real basket; that is
 * not something to hand a language model without a human in the loop.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { getApiBase } from './lib/api-client.js';
import { createServer } from './lib/server-factory.js';

const server = createServer();

async function main() {
  // stderr only: stdout is the MCP transport, and anything written there
  // corrupts the protocol stream.
  console.error(`recipe-manager MCP server → ${getApiBase()}`);
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
