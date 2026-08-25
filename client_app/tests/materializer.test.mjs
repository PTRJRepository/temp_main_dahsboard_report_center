'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeParameters } from '../src/firebird/materializer.js';

test('substitutes :name with string literal', () => {
  const result = materializeParameters(
    'SELECT FIRST 100 ID FROM JOBCODE WHERE ITEMNO = :itemNo',
    [{ name: 'itemNo', value: "ABC'01", type: 'string' }],
  );
  assert.equal(result.success, true);
  assert.equal(result.queryText, "SELECT FIRST 100 ID FROM JOBCODE WHERE ITEMNO = 'ABC''01'");
});

test('supports map form of parameters', () => {
  const result = materializeParameters(
    'SELECT 1 FROM RDB$DATABASE WHERE X = :a AND Y = :b',
    { a: { value: 5, type: 'int' }, b: { value: 'z', type: 'string' } },
  );
  assert.equal(result.success, true);
  assert.equal(result.queryText, "SELECT 1 FROM RDB$DATABASE WHERE X = 5 AND Y = 'z'");
});

test('substitutes {{name}} placeholders', () => {
  const result = materializeParameters(
    'SELECT 1 FROM RDB$DATABASE WHERE X = {{alpha}}',
    { alpha: { value: 1, type: 'int' } },
  );
  assert.equal(result.success, true);
  assert.equal(result.queryText, 'SELECT 1 FROM RDB$DATABASE WHERE X = 1');
});

test('typed literals: int, decimal, bool, date, timestamp', () => {
  const result = materializeParameters(
    ':i :d :b :dt :ts',
    [
      { name: 'i', value: '42', type: 'integer' },
      { name: 'd', value: '3.14', type: 'decimal' },
      { name: 'b', value: true, type: 'boolean' },
      { name: 'dt', value: '2026-08-25', type: 'date' },
      { name: 'ts', value: '2026-08-25 10:00:00', type: 'timestamp' },
    ],
  );
  assert.equal(result.success, true);
  assert.equal(result.queryText, "42 3.14 1 DATE '2026-08-25' TIMESTAMP '2026-08-25 10:00:00'");
});

test('null becomes NULL regardless of declared type', () => {
  const result = materializeParameters('X = :x', [{ name: 'x', value: null, type: 'string' }]);
  assert.equal(result.success, true);
  assert.equal(result.queryText, 'X = NULL');
});

test('default (untyped) values: number raw, boolean 1/0, text quoted', () => {
  const result = materializeParameters(':n :t :f :s', [
    { name: 'n', value: 7 },
    { name: 't', value: true },
    { name: 'f', value: false },
    { name: 's', value: 'hi' },
  ]);
  assert.equal(result.success, true);
  assert.equal(result.queryText, "7 1 0 'hi'");
});

test('placeholder inside string literal is not substituted', () => {
  const result = materializeParameters("SELECT 1 FROM RDB$DATABASE WHERE S = ':name'", []);
  // missing param error is expected because :name outside strings is absent,
  // but the placeholder inside quotes must NOT be treated as a placeholder.
  assert.deepEqual(result.errors.filter(e => e.includes(':name')), []);
});

test('missing parameter reports error and keeps original text', () => {
  const result = materializeParameters('SELECT 1 FROM T WHERE A = :missing', []);
  assert.equal(result.success, false);
  assert.match(result.errors[0], /required by query text/);
  assert.equal(result.queryText, 'SELECT 1 FROM T WHERE A = :missing');
});

test('invalid parameter name is rejected', () => {
  const result = materializeParameters('SELECT 1 FROM T WHERE A = :1bad', [{ name: '1bad', value: 1 }]);
  assert.equal(result.success, false);
});

test('duplicate parameter names are rejected', () => {
  const result = materializeParameters('SELECT 1 FROM T WHERE A = :x', [
    { name: 'x', value: 1 },
    { name: 'X', value: 2 },
  ]);
  assert.equal(result.success, false);
  assert.match(result.errors[0], /Duplicate parameter/);
});

test('parameter count limit enforced', () => {
  const result = materializeParameters('SELECT 1 FROM RDB$DATABASE WHERE A = :a AND B = :b', [
    { name: 'a', value: 1 },
    { name: 'b', value: 2 },
  ], 1);
  assert.equal(result.success, false);
  assert.match(result.errors[0], /Parameter count exceeds/);
});

test('decimal type rejects hex and Infinity like .NET TryParse', () => {
  const result = materializeParameters(':a :b', [
    { name: 'a', value: '0x10', type: 'decimal' },
    { name: 'b', value: 'Infinity', type: 'number' },
  ]);
  assert.equal(result.success, false);
  assert.equal(result.errors.length, 2);
});
