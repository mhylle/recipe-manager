import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBearer, tokenMatches, requireToken, isAuthorised } from '../lib/auth.js';

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
