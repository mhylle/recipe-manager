import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import * as recipes from '../tools/recipes.js';
import * as pantry from '../tools/pantry.js';
import * as planning from '../tools/planning.js';
import { mondayOf } from '../tools/planning.js';
import { getApiBase, buildResponse, buildError } from '../lib/api-client.js';

const allTools = [...recipes.tools, ...pantry.tools, ...planning.tools];

describe('tool catalogue', () => {
  test('every tool has a unique name', () => {
    const names = allTools.map((t) => t.name);
    assert.equal(new Set(names).size, names.length, 'duplicate tool name');
  });

  test('every tool has a description and an object schema', () => {
    for (const t of allTools) {
      assert.ok(t.description?.length > 30, `${t.name}: description too thin`);
      assert.equal(t.inputSchema.type, 'object', `${t.name}: schema must be an object`);
      assert.equal(typeof t.handler, 'function', `${t.name}: missing handler`);
    }
  });

  test('required properties are actually declared in the schema', () => {
    // A required key with no matching property is invisible to the model.
    for (const t of allTools) {
      for (const key of t.inputSchema.required ?? []) {
        assert.ok(
          Object.hasOwn(t.inputSchema.properties ?? {}, key),
          `${t.name}: required '${key}' is not a declared property`,
        );
      }
    }
  });

  test('BilkaToGo is not exposed', () => {
    // Those endpoints touch real grocery credentials and a real basket. This
    // assertion is the guard against re-adding them without a deliberate decision.
    const surface = JSON.stringify(allTools.map((t) => [t.name, t.description])).toLowerCase();
    assert.ok(!surface.includes('bilkatogo login'), 'BilkaToGo login must not be exposed');
    assert.ok(
      !allTools.some((t) => t.name.toLowerCase().includes('bilka')),
      'no tool may target BilkaToGo',
    );
  });

  test('destructive tools say so in their description', () => {
    for (const name of ['recipes_delete', 'pantry_delete']) {
      const t = allTools.find((x) => x.name === name);
      assert.match(t.description, /permanent|no undo|confirm/i, `${name}: no warning`);
    }
  });
});

describe('api base', () => {
  const saved = process.env.RECIPE_MANAGER_API_URL;
  beforeEach(() => delete process.env.RECIPE_MANAGER_API_URL);
  afterEach(() => {
    if (saved === undefined) delete process.env.RECIPE_MANAGER_API_URL;
    else process.env.RECIPE_MANAGER_API_URL = saved;
  });

  test('defaults to production', () => {
    assert.equal(getApiBase(), 'https://mhylle.com/api/recipe-manager/api');
  });

  test('is overridable, and a trailing slash does not produce a double slash', () => {
    process.env.RECIPE_MANAGER_API_URL = 'http://localhost:3000/api/';
    assert.equal(getApiBase(), 'http://localhost:3000/api');
  });
});

describe('mondayOf', () => {
  test('returns the same day when given a Monday', () => {
    assert.equal(mondayOf(new Date(2026, 6, 27)), '2026-07-27'); // a Monday
  });

  test('walks back to Monday from mid-week', () => {
    assert.equal(mondayOf(new Date(2026, 6, 30)), '2026-07-27'); // Thursday
  });

  test('treats Sunday as the END of its week, not the start', () => {
    // Distractor: the naive `date - getDay()` puts Sunday on the following week.
    assert.equal(mondayOf(new Date(2026, 7, 2)), '2026-07-27'); // Sunday
  });
});

describe('response envelopes', () => {
  test('objects are pretty-printed as text content', () => {
    const r = buildResponse({ a: 1 });
    assert.equal(r.content[0].type, 'text');
    assert.match(r.content[0].text, /"a": 1/);
    assert.ok(!r.isError);
  });

  test('errors are flagged so the model can recover', () => {
    const r = buildError(new Error('nope'));
    assert.equal(r.isError, true);
    assert.equal(r.content[0].text, 'nope');
  });
});
