import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';

import { createRequestHandler } from '../lib/http-app.js';

const TOKEN = 'a'.repeat(64);

let server;
let base;

before(async () => {
  server = createHttpServer(createRequestHandler({ token: TOKEN }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  },
};

function post(body, { sessionId, token = TOKEN } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers['X-MCP-Token'] = token;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  return fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('http transport', () => {
  test('/health is open and says nothing but liveness', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  test('rejects an unauthenticated MCP request', async () => {
    const res = await post(INITIALIZE, { token: null });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /Bearer/);
  });

  test('initialize opens a session', async () => {
    const res = await post(INITIALIZE);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('mcp-session-id'), 'expected a session id header');
    await res.body?.cancel();
  });

  test('a session id the server does not know gets 404, not a dead end', async () => {
    // What every connected client holds after the container restarts: sessions
    // live in memory, so each id is unknown to the new process. 404 is the
    // spec's signal to open a fresh session; anything else strands the client
    // until a human restarts Claude Desktop.
    const res = await post(
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { sessionId: '00000000-dead-beef-0000-000000000000' },
    );
    assert.equal(res.status, 404);
    const payload = await res.json();
    assert.equal(payload.jsonrpc, '2.0');
    assert.match(payload.error.message, /session/i);
  });

  test('a client re-initializes after a 404 and works again', async () => {
    const res = await post(INITIALIZE);
    assert.equal(res.status, 200);
    const sessionId = res.headers.get('mcp-session-id');
    assert.ok(sessionId);
    await res.body?.cancel();

    const notify = await post(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { sessionId },
    );
    assert.equal(notify.status, 202);

    const tools = await post({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, { sessionId });
    assert.equal(tools.status, 200);
    await tools.body?.cancel();
  });

  test('a non-initialize request with no session id is refused, not silently given one', async () => {
    const res = await post({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    assert.equal(res.status, 400);
    await res.body?.cancel();
  });

  test('a malformed body is a parse error, not a 500', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-MCP-Token': TOKEN,
      },
      body: '{not json',
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, -32700);
  });
});
