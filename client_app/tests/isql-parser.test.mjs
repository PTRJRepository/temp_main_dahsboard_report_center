'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIsqlOutput } from '../src/firebird/executor.js';

// Fixture ala isql asli: teks header & nilai berada DI DALAM rentang kolomnya
// masing-masing (kolom1 = [0,12), kolom2 = [13,32)).
const HEADER = 'ID           CODE               ';
const SEP    = '============ ===================';

function row(v1, v2) {
  return v1.padEnd(12) + ' ' + v2.padEnd(18);
}

test('parses headers, rows, and ranges', () => {
  const out = [HEADER, SEP, row('1', 'COMPANY-A'), row('2', 'COMPANY-B'), ''].join('\r\n');
  const result = parseIsqlOutput(out, 1000, 12);
  assert.deepEqual(result.headers, ['ID', 'CODE']);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].ID, '1');
  assert.equal(result.rows[0].CODE, 'COMPANY-A');
  assert.equal(result.rows[1].CODE, 'COMPANY-B');
  assert.equal(result.rowCount, 2);
  assert.equal(result.isTruncated, false);
  assert.equal(result.executionTimeMs, 12);
});

test('right-aligned numeric cells are trimmed', () => {
  const out = [HEADER, SEP, row('7', 'X')].join('\n');
  const result = parseIsqlOutput(out.replace(row('7', 'X'), '          7 ' + 'X'.padEnd(19)), 10, 1);
  assert.equal(result.rows[0].ID, '7');
});

test('respects maxRows and flags truncation', () => {
  const out = [HEADER, SEP, row('1', 'A'), row('2', 'B')].join('\n');
  const result = parseIsqlOutput(out, 1, 5);
  assert.equal(result.rows.length, 1);
  assert.equal(result.isTruncated, true);
});

test('empty cells become null', () => {
  const line = '7         '.padEnd(12) + ' ' + ' '.repeat(19);
  const out = [HEADER, SEP, line].join('\n');
  const result = parseIsqlOutput(out, 10, 1);
  assert.deepEqual(result.rows, [{ ID: '7', CODE: null }]);
});

test('skips repeated header rows on page breaks (multi-page isql)', () => {
  const out = [
    HEADER,
    SEP,
    row('1', 'A'),
    HEADER,
    SEP,
    row('2', 'B'),
  ].join('\n');
  const result = parseIsqlOutput(out, 100, 3);
  assert.deepEqual(
    result.rows.map(r => r.CODE),
    ['A', 'B'],
  );
});

test('skips isql row-count footer lines', () => {
  const out = [HEADER, SEP, row('1', 'A'), '2 rows selected'].join('\n');
  const result = parseIsqlOutput(out, 100, 1);
  assert.equal(result.rows.length, 1);
});

test('throws on isql error markers', () => {
  const output = 'Statement failed, SQLSTATE = 28000\nYour user name and password are not defined.';
  assert.throws(() => parseIsqlOutput(output, 10, 1), /user name and password/i);
});

test('throws when no separator line exists', () => {
  assert.throws(() => parseIsqlOutput('Use CONNECT or CREATE DATABASE to specify a database', 10, 1));
});
