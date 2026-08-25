'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReadOnlySql } from '../src/firebird/validator.js';

test('accepts plain SELECT', () => {
  const result = validateReadOnlySql('SELECT FIRST 1 RDB$RELATION_NAME FROM RDB$RELATIONS');
  assert.equal(result.valid, true);
});

test('accepts WITH ... SELECT', () => {
  const result = validateReadOnlySql(
    "WITH t AS (SELECT ID FROM COMPANY) SELECT * FROM t WHERE ID = 'X'",
  );
  assert.equal(result.valid, true);
});

test('accepts trailing semicolon', () => {
  assert.equal(validateReadOnlySql('SELECT 1 FROM RDB$DATABASE;').valid, true);
});

test('rejects empty query', () => {
  assert.equal(validateReadOnlySql('   ').valid, false);
});

test('rejects write and ddl keywords', () => {
  for (const sql of [
    'INSERT INTO COMPANY VALUES (1)',
    'UPDATE COMPANY SET CODE = 1',
    'DELETE FROM COMPANY',
    'DROP TABLE COMPANY',
    'ALTER TABLE COMPANY ADD X INT',
    'CREATE TABLE X (ID INT)',
    'EXECUTE PROCEDURE DO_THINGS',
    'MERGE INTO COMPANY',
    'TRUNCATE TABLE COMPANY',
    'GRANT ALL ON COMPANY TO PUBLIC',
    'REVOKE ALL ON COMPANY FROM PUBLIC',
    'COMMIT',
    'ROLLBACK',
    'SET TERM ^',
    'DECLARE X INT',
  ]) {
    const result = validateReadOnlySql(sql);
    assert.equal(result.valid, false, `should reject: ${sql}`);
  }
});

test('rejects blocked keyword even inside WITH', () => {
  assert.equal(validateReadOnlySql('WITH t AS (SELECT 1 FROM X) SELECT * FROM t UNION SELECT * FROM Y DELETE').valid, false);
});

test('rejects comments', () => {
  assert.equal(validateReadOnlySql('SELECT 1 FROM RDB$DATABASE -- hello').valid, false);
  assert.equal(validateReadOnlySql('SELECT /* x */ 1 FROM RDB$DATABASE').valid, false);
});

test('allows comment-like text inside string literal', () => {
  const result = validateReadOnlySql("SELECT FIRST 1 ID FROM COMPANY WHERE NOTE = '-- not a comment'");
  assert.equal(result.valid, true);
});

test('rejects multiple statements', () => {
  assert.equal(validateReadOnlySql('SELECT 1 FROM RDB$DATABASE; SELECT 2 FROM RDB$DATABASE').valid, false);
});

test('rejects non-select first token', () => {
  assert.equal(validateReadOnlySql('SHOW TABLES').valid, false);
});

test('rejects WITH that contains no SELECT anywhere', () => {
  // Sama seperti validator .NET: cukup ada \bSELECT\b di mana pun pada WITH.
  assert.equal(validateReadOnlySql('WITH t AS (VALUES 1) LIST t').valid, false);
});

test('rejects WITH followed by write statement', () => {
  assert.equal(validateReadOnlySql('WITH t AS (SELECT 1 FROM X) UPDATE Y SET A = 1').valid, false);
});

test('rejects query longer than limit', () => {
  const long = `SELECT '${'x'.repeat(200)}' FROM RDB$DATABASE`;
  assert.equal(validateReadOnlySql(long, 100).valid, false);
});
