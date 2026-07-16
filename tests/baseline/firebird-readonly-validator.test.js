/**
 * Baseline test: SQL read-only validation corpus.
 * Tests isReadOnlySql() from ifess-control-server/service.js.
 *
 * This is a LOCAL test — imports directly from the service module.
 * When Firebird Query Service is extracted, move this alongside it.
 */

import assert from 'node:assert/strict'
import { isReadOnlySql } from '../../Services/ifess-control-server/service.js'

// ── Valid: should pass ─────────────────────────────────────────────────────────

const VALID_QUERIES = [
  'SELECT * FROM EMP',
  'SELECT EMP_ID, EMP_NAME FROM EMP WHERE OCID = 5',
  '  SELECT COUNT(*) FROM GWSCANNERDATA01  ',
  'WITH cte AS (SELECT 1) SELECT * FROM cte',
  'select emp_id, emp_name from emp where emp_id = 1',
  '  SELECT FIRST 100 * FROM EMP  ',
  'SELECT A.EMP_NAME, B.OC_NAME FROM EMP A JOIN OC B ON A.OCID = B.ID',
  'SELECT TRANSDATE, SUM(TBSCOUNT) FROM FFBSCANNERDATA01 GROUP BY TRANSDATE',
]

// ── Invalid: should be rejected ────────────────────────────────────────────────

const INVALID_QUERIES = [
  // DML
  { sql: 'INSERT INTO EMP VALUES (1, \'test\')', label: 'INSERT' },
  { sql: '  INSERT INTO EMP (EMP_ID) VALUES (999)', label: 'INSERT whitespace' },
  { sql: 'UPDATE EMP SET EMP_NAME = \'x\' WHERE EMP_ID = 1', label: 'UPDATE' },
  { sql: 'update emp set emp_name = \'x\'', label: 'UPDATE lowercase' },
  { sql: 'DELETE FROM EMP WHERE EMP_ID = 999', label: 'DELETE' },
  { sql: 'delete emp', label: 'DELETE no where' },

  // DDL
  { sql: 'DROP TABLE EMP', label: 'DROP TABLE' },
  { sql: 'ALTER TABLE EMP ADD COLUMN X INT', label: 'ALTER TABLE' },
  { sql: 'CREATE TABLE X (ID INT)', label: 'CREATE TABLE' },
  { sql: 'TRUNCATE TABLE EMP', label: 'TRUNCATE' },

  // DCL
  { sql: 'GRANT ALL ON EMP TO PUBLIC', label: 'GRANT' },
  { sql: 'REVOKE SELECT ON EMP FROM PUBLIC', label: 'REVOKE' },

  // TCL
  { sql: 'COMMIT', label: 'COMMIT' },
  { sql: 'ROLLBACK', label: 'ROLLBACK' },
  { sql: 'SAVEPOINT S1', label: 'SAVEPOINT' },

  // Injection tricks
  { sql: 'SELECT * FROM EMP; DROP TABLE EMP--', label: 'semicolon injection' },
  { sql: 'SELECT * FROM EMP; --', label: 'semicolon comment' },
  { sql: 'EXECUTE SP_DROP_TABLE', label: 'EXECUTE' },
  { sql: 'EXEC SP_DROP_TABLE', label: 'EXEC shorthand' },

  // Not starting with SELECT
  { sql: '', label: 'empty string' },
  { sql: null, label: 'null' },
  { sql: undefined, label: 'undefined' },
  { sql: 'SHOW TABLES', label: 'SHOW (not SELECT)' },
  { sql: 'DESCRIBE EMP', label: 'DESCRIBE' },
  { sql: 'SELECT * FROM EMP; INSERT INTO X VALUES (1)', label: 'SELECT+INSERT via semicolon' },
]

// ── Edge cases: valid but tricky ──────────────────────────────────────────────

const EDGE_CASES = [
  // Column names that happen to contain forbidden words
  { sql: 'SELECT GRANTS FROM EMP', label: 'GRANTS as column name' },
  { sql: 'SELECT COMMITTEE FROM EMP', label: 'COMMITTEE as column name' },
  { sql: 'SELECT UPDATE FROM EMP', label: 'UPDATE as column name' },
  { sql: 'SELECT DROPPED FROM EMP', label: 'DROPPED (not DROP)' },
  { sql: 'SELECT INSERTED_BY FROM EMP', label: 'INSERTED_BY (not INSERT)' },
  { sql: 'SELECT GRANTED FROM EMP', label: 'GRANTED (not GRANT)' },
  // BETWEEN/IN with parentheses (should not match ; pattern)
  { sql: 'SELECT * FROM EMP WHERE EMP_ID IN (1, 2, 3)', label: 'IN clause with parens' },
  { sql: 'SELECT * FROM EMP WHERE EMP_NAME LIKE \'%DROP%\'', label: 'LIKE pattern with DROP substring' },
  // WITH block
  { sql: 'WITH emp_cte AS (SELECT EMP_ID FROM EMP) SELECT * FROM emp_cte', label: 'WITH block' },
  // FIRST keyword
  { sql: 'SELECT FIRST 10 * FROM EMP ORDER BY EMP_ID', label: 'FIRST keyword' },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

// T1-T8: Valid queries must pass
for (const sql of VALID_QUERIES) {
  const result = isReadOnlySql(sql)
  if (result.valid) {
    passed++
    console.log(`  ✓ VALID: ${sql.slice(0, 50)}`)
  } else {
    failed++
    console.log(`  ✗ VALID unexpectedly rejected: "${sql}" → ${result.errors.join(', ')}`)
  }
}

// T9+: Invalid queries must be rejected
for (const { sql, label } of INVALID_QUERIES) {
  const result = isReadOnlySql(sql)
  if (!result.valid) {
    passed++
    console.log(`  ✓ INVALID rejected: ${label}`)
  } else {
    failed++
    console.log(`  ✗ INVALID not rejected: "${sql}" (label: ${label})`)
  }
}

// Edge cases: these should pass (column names with forbidden substrings)
for (const { sql, label } of EDGE_CASES) {
  const result = isReadOnlySql(sql)
  if (result.valid) {
    passed++
    console.log(`  ✓ EDGE valid: ${label}`)
  } else {
    failed++
    console.log(`  ✗ EDGE false positive: "${sql}" → ${result.errors.join(', ')}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('\n❌ Baseline validation FAILED')
  process.exit(1)
} else {
  console.log('✅ All baseline validation tests passed')
  console.log('   These tests verify isReadOnlySql() behavior BEFORE any extraction refactor.')
}
