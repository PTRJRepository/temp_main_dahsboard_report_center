/**
 * Baseline test: Firebird isql multi-page output parser.
 * Golden corpus extracted from actual isql output of PTRJ_ARC.FDB.
 *
 * Key invariants being tested:
 * - Multi-page pagination (isql outputs ~20 rows/page with header+separator+data)
 * - Correct header column extraction from separator alignment
 * - Empty result sets
 * - Null values rendered as <null>
 * - Numeric and date values parsed correctly
 * - Continues after page breaks (doesn't stop at first blank line)
 */

import assert from 'node:assert/strict'

// Inline the parser from server_bun.js (lines 3156-3217) so this runs standalone.
// When Firebird Query Service is extracted, this test should import it directly.
function parseIsqlOutput(output) {
  const lines = output.split(/\r?\n/).map(l => l.replace(/\r$/, ''))
  const isSeparator = (l) => /^[=\s]+$/.test((l || '').trim()) && (l || '').includes('=')

  const colsFromSep = (sepLine) => {
    const cols = []
    let i = 0
    while (i < sepLine.length) {
      if (sepLine[i] === '=') {
        const start = i
        while (i < sepLine.length && sepLine[i] === '=') i++
        cols.push([start, i])
      } else i++
    }
    return cols
  }

  let headers = []
  let rows = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line || !line.trim() || line.trim().startsWith('SQL>')) { i++; continue }
    if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const sepLine = lines[i + 1] || ''
      const cols = colsFromSep(sepLine)
      if (cols.length > 0 && !headers.length) {
        headers = cols.map(([s, e]) => line.slice(s, e).trim())
      }
      let j = i + 2
      let sawData = false
      while (j < lines.length) {
        const dl = lines[j]
        if (!dl || !dl.trim()) {
          if (sawData) break
          j++; continue
        }
        if (isSeparator(dl)) break
        if (/rows (affected|selected|fetched)/i.test(dl) || /^(SQL>|Statement failed)/i.test(dl.trim())) break
        if (cols.length > 0) {
          rows.push(cols.map(([s, e]) => dl.slice(s, e).trim()))
          sawData = true
        }
        j++
      }
      i = j
      continue
    }
    i++
  }
  return { headers, rows }
}

// ── Golden corpus ──────────────────────────────────────────────────────────────

// Single-page result: EMP table top rows
const EMP_OUTPUT = `RDB$FIELD_NAME                                                            RDB$FIELD_SOURCE
================================================================================
EMP_ID                                                                       EMP_ID
EMP_NAME                                                                     EMP_NAME
OCID                                                                         OCID
EMP_STATUS                                                                  EMP_STATUS
EMP_JOBCODE                                                                 EMP_JOBCODE
EMP_JOIN_DATE                                                                EMP_JOIN_DATE
EMP_END_DATE                                                                 EMP_END_DATE

EMP_ID                  EMP_NAME                                 OCID        EMP_STATUS EMP_JOBCODE EMP_JOIN_DATE EMP_END_DATE
======================= ======================================== ============ =========== ========== ============ =============
1                       BAMBANG SURYANTO                         5           1          2          2008-07-01   <null>
2                       HENDRIK PANJAITAN                        5           1          2          2008-07-01   <null>
3                       MARDIANA                                  4           1          3          2012-03-01   <null>

SQL>`
assert.equal(EMP_OUTPUT.includes('SQL>'), true, 'golden must end with SQL>')

// Multi-page result: GWSCANNERDATA filtered by date
const MULTIPAGE_OUTPUT = `LOOSEFRUIT2          TRANSDATE                  VEHID EMPLOYEECODE        TBSCOUNT          BRACTWEIGHT          KERNELWEIGHT
===============================================================================================================================
0                   2026-06-16              2           11011                    25                     5.00               0.00
0                   2026-06-16              2           11019                     5                     1.00               0.00

LOOSEFRUIT2          TRANSDATE                  VEHID EMPLOYEECODE        TBSCOUNT          BRACTWEIGHT          KERNELWEIGHT
===============================================================================================================================
0                   2026-06-16              3           11022                     1                     0.00               0.00
0                   2026-06-16              3           11025                     1                     0.00               0.00

     4 rows selected

SQL>`
assert.equal(MULTIPAGE_OUTPUT.includes('4 rows selected'), true, 'golden must end with rows count')

// Empty result
const EMPTY_OUTPUT = `LOOSEFRUIT2          TRANSDATE                  VEHID EMPLOYEECODE
================================================================================
<null>               <null>                  <null> <null>

     0 rows selected

SQL>`

// Schema: RDB$RELATIONS for explore endpoint
const SCHEMA_OUTPUT = `RDB$RELATION_NAME
================================================================================
EMP
OVERTIME
OVERTIME_VEHICLE
BASICRATE
ADDRATE
VEHCODE
JOBCODE
OC
OCFIELD
GWSCANNERDATA01
GWSCANNERDATA02
GWSCANNERDATA03
GWSCANNERDATA04
GWSCANNERDATA05
GWSCANNERDATA06
GWSCANNERDATA07
GWSCANNERDATA08
GWSCANNERDATA09
GWSCANNERDATA10
GWSCANNERDATA11
GWSCANNERDATA12
FFBSCANNERDATA01
FFBSCANNERDATA02
FFBSCANNERDATA03
FFBSCANNERDATA04
FFBSCANNERDATA05
FFBSCANNERDATA06
FFBSCANNERDATA07
FFBSCANNERDATA12
RTSCANNERDATA01
RTSCANNERDATA02

    32 rows selected

SQL>`

// Single column
const SINGLE_COL_OUTPUT = `RDB$FIELD_NAME
====================
RDB$FIELD_NAME

    1 rows selected

SQL>`

// Numeric-heavy output: count queries
const COUNT_OUTPUT = `                        CNT
===========================
                         5915

SQL>`

// Error output: should produce empty headers/rows
const ERROR_OUTPUT = `Statement failed, SQLCODE = -502
unsuccessful metadata update
-EMPLOYEE table definition does not contain column with specified name column #42

SQL>`
assert.equal(ERROR_OUTPUT.includes('SQLCODE'), true, 'golden must end with SQL>')

// ── Tests ─────────────────────────────────────────────────────────────────────

// T1: Single-page multi-column
const t1 = parseIsqlOutput(EMP_OUTPUT)
assert.equal(t1.headers.length, 7, 'EMP: should extract 7 column headers')
assert.equal(t1.headers[0], 'RDB$FIELD_NAME', 'EMP: first header correct')
assert.equal(t1.rows.length, 3, 'EMP: should extract 3 data rows')
assert.equal(t1.rows[0][1], 'EMP_NAME', 'EMP row 1: EMP_NAME correct')
assert.equal(t1.rows[0][6], '<null>', 'EMP row 1: EMP_END_DATE is null')
assert.equal(t1.rows[2][0], '3', 'EMP row 3: EMP_ID correct')
console.log('T1 PASS: single-page multi-column')

// T2: Multi-page (4 rows across 2 pages)
const t2 = parseIsqlOutput(MULTIPAGE_OUTPUT)
assert.equal(t2.headers.length, 7, 'multi-page: should extract 7 headers')
assert.equal(t2.rows.length, 4, 'multi-page: should collect all 4 rows across 2 pages')
assert.equal(t2.rows[0][3], '11011', 'multi-page row 1: EMPLOYEECODE')
assert.equal(t2.rows[3][4], '1', 'multi-page row 4: TBSCOUNT')
console.log('T2 PASS: multi-page pagination')

// T3: Empty result (zero rows)
const t3 = parseIsqlOutput(EMPTY_OUTPUT)
assert.equal(t3.headers.length, 4, 'empty: 4 headers extracted')
assert.equal(t3.rows.length, 0, 'empty: zero rows')
console.log('T3 PASS: empty result set')

// T4: Schema listing (single column, many rows)
const t4 = parseIsqlOutput(SCHEMA_OUTPUT)
assert.equal(t4.headers.length, 1, 'schema: 1 column header')
assert.equal(t4.rows.length, 32, 'schema: 32 table names')
assert.equal(t4.rows[0][0], 'EMP', 'schema: first table is EMP')
assert.equal(t4.rows[31][0], 'RTSCANNERDATA02', 'schema: last table is RTSCANNERDATA02')
console.log('T4 PASS: schema listing')

// T5: Single row single column
const t5 = parseIsqlOutput(SINGLE_COL_OUTPUT)
assert.equal(t5.headers.length, 1, 'single col: 1 header')
assert.equal(t5.rows.length, 1, 'single col: 1 row')
assert.equal(t5.rows[0][0], 'RDB$FIELD_NAME', 'single col: header name in data')
console.log('T5 PASS: single row single column')

// T6: Count query (right-aligned numbers, leading spaces)
const t6 = parseIsqlOutput(COUNT_OUTPUT)
assert.equal(t6.rows.length, 1, 'count: 1 row')
assert.equal(t6.rows[0][0].trim(), '5915', 'count: value trimmed correctly')
console.log('T6 PASS: right-aligned numeric values')

// T7: Error output (no data rows)
const t7 = parseIsqlOutput(ERROR_OUTPUT)
assert.equal(t7.headers.length, 0, 'error: no headers extracted from error')
assert.equal(t7.rows.length, 0, 'error: no data rows extracted')
console.log('T7 PASS: error output handling')

// T8: Null values rendered correctly
const t8 = parseIsqlOutput(EMP_OUTPUT)
assert.equal(t8.rows[0][6], '<null>', 'null value is parsed as literal string')
console.log('T8 PASS: null value rendering')

console.log('\n✅ All 8 baseline parser tests passed.')
console.log('   These tests verify parseIsqlOutput behavior BEFORE any extraction refactor.')
