import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearer,
  tokenMatches,
  requireToken,
  isAuthorised,
  isPersonalKey,
} from '../lib/auth.js';

const SECRET = 'a'.repeat(64);

describe('extractBearer', () => {
  test('pulls the token out of a well-formed header', () => {
    assert.equal(extractBearer('Bearer abc123'), 'abc123');
  });

  test('is case-insensitive on the scheme and tolerates extra spaces', () => {
    assert.equal(extractBearer('bearer   abc123'), 'abc123');
    assert.equal(extractBearer('  BEARER abc123  '), 'abc123');
  });

  test('rejects anything that is not a bearer header', () => {
    for (const bad of ['abc123', 'Basic abc123', 'Bearer', '', null, undefined, 42]) {
      assert.equal(extractBearer(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe('tokenMatches', () => {
  test('accepts the exact token', () => {
    assert.equal(tokenMatches(SECRET, SECRET), true);
  });

  test('rejects a wrong token of the same length', () => {
    assert.equal(tokenMatches('b'.repeat(64), SECRET), false);
  });

  test('rejects a prefix — the classic partial-compare bug', () => {
    // A naive `presented === expected.slice(0, presented.length)` would pass.
    assert.equal(tokenMatches('a'.repeat(63), SECRET), false);
    assert.equal(tokenMatches('a', SECRET), false);
  });

  test('rejects a longer token that starts with the secret', () => {
    assert.equal(tokenMatches(SECRET + 'x', SECRET), false);
  });

  test('rejects empty and non-string input without throwing', () => {
    for (const bad of ['', null, undefined, 0, {}]) {
      assert.equal(tokenMatches(bad, SECRET), false);
    }
  });
});

describe('isAuthorised', () => {
  test('accepts a correct bearer header', () => {
    assert.equal(isAuthorised({ authorization: `Bearer ${SECRET}` }, SECRET), true);
  });

  test('rejects a missing header', () => {
    assert.equal(isAuthorised({}, SECRET), false);
  });

  test('rejects a wrong token', () => {
    assert.equal(isAuthorised({ authorization: 'Bearer nope' }, SECRET), false);
  });

  test('accepts the space-free X-MCP-Token header', () => {
    // The whole reason this header exists: a value with no space survives
    // cmd.exe re-parsing on Windows, where `Bearer <token>` can arrive split.
    assert.equal(isAuthorised({ 'x-mcp-token': SECRET }, SECRET), true);
  });

  test('rejects a wrong X-MCP-Token', () => {
    assert.equal(isAuthorised({ 'x-mcp-token': 'nope' }, SECRET), false);
  });

  test('does not let an empty X-MCP-Token through', () => {
    assert.equal(isAuthorised({ 'x-mcp-token': '   ' }, SECRET), false);
  });

  test('a valid X-MCP-Token does not rescue a malformed Authorization header', () => {
    // Authorization wins when present and parseable; a client sending both a
    // broken bearer and a good fallback should still be told the bearer is bad,
    // rather than silently succeeding on a header it did not mean to rely on.
    assert.equal(
      isAuthorised({ authorization: 'Bearer wrong', 'x-mcp-token': SECRET }, SECRET),
      false,
    );
  });
});

describe('requireToken', () => {
  const saved = process.env.RECIPE_MANAGER_MCP_TOKEN;
  const restore = () => {
    if (saved === undefined) delete process.env.RECIPE_MANAGER_MCP_TOKEN;
    else process.env.RECIPE_MANAGER_MCP_TOKEN = saved;
  };

  test('refuses to start with no token — never defaults to open', () => {
    delete process.env.RECIPE_MANAGER_MCP_TOKEN;
    assert.throws(() => requireToken(), /must be set/);
    restore();
  });

  test('refuses a token short enough to brute-force', () => {
    process.env.RECIPE_MANAGER_MCP_TOKEN = 'short';
    assert.throws(() => requireToken(), /32 characters/);
    restore();
  });

  test('accepts a long secret', () => {
    process.env.RECIPE_MANAGER_MCP_TOKEN = SECRET;
    assert.equal(requireToken(), SECRET);
    restore();
  });
});


describe('personal MCP keys', () => {
  it('recognises a key by its prefix', () => {
    assert.equal(isPersonalKey('rmk_abcdef'), true);
    assert.equal(isPersonalKey('not-a-key'), false);
    assert.equal(isPersonalKey(undefined), false);
    assert.equal(isPersonalKey(null), false);
  });

  it('lets a personal key through without matching the shared token', () => {
    // This process holds no key material. Only the backend can say whether a
    // personal key is real, whose it is, or whether it was revoked — so a write
    // with a bogus key gets a 401 from the API, and reads are public anyway.
    assert.equal(isAuthorised({ 'x-mcp-token': 'rmk_whatever' }, SECRET), true);
    assert.equal(isAuthorised({ authorization: 'Bearer rmk_whatever' }, SECRET), true);
  });

  it('still accepts the shared service token', () => {
    // A Desktop config that predates personal keys must keep working.
    assert.equal(isAuthorised({ authorization: `Bearer ${SECRET}` }, SECRET), true);
  });

  it('still rejects a wrong non-personal token', () => {
    assert.equal(isAuthorised({ authorization: 'Bearer wrong-token-entirely' }, SECRET), false);
    assert.equal(isAuthorised({}, SECRET), false);
  });
});
