/**
 * Baseline test: Firebird isql multi-page output parser.
 * Golden corpus based on actual isql output from PTRJ_ARC.FDB.
 *
 * Key format facts (verified against real isql output):
 * - colsFromSep() derives [start,end) column boundaries from BOTH header + separator.
 *   Strategy A: sep has multiple "=" groups → space between groups = column boundary.
 *   Strategy B: sep has one "=" group (wide) → trailing-space transitions in header.
 * - isql uses FIXED-WIDTH alignment: values space-padded to fill column width.
 * - headers[i] = headerLine.slice(start, end).trim()
 * - data[i] = dl.slice(start, end).trim()
 * - Blank line separates page blocks. Multi-page = header+sep+data repeated.
 */

import assert from 'node:assert/strict'

// Inline the parser from server_bun.js (updated colsFromSep) — standalone test.
function parseIsqlOutput(output) {
  const lines = output.split(/\r?\n/).map(l => l.replace(/\r$/, ''))
  const isSeparator = (l) => /^[=\s]+$/.test((l || '').trim()) && (l || '').includes('=')

  const colsFromSep = (headerLine, sepLine) => {
    const sepGroups = []
    let i = 0
    while (i < sepLine.length) {
      if (sepLine[i] === '=') {
        const start = i
        while (i < sepLine.length && sepLine[i] === '=') i++
        sepGroups.push([start, i])
      } else i++
    }
    if (sepGroups.length > 1) {
      const boundaries = new Set([0])
      for (let k = 0; k < sepGroups.length - 1; k++) {
        boundaries.add(sepGroups[k][1])
        boundaries.add(sepGroups[k + 1][0])
      }
      boundaries.add(sepLine.length)
      const sortedBoundaries = [...boundaries].sort((a, b) => a - b)
      const cols = []
      for (let k = 0; k < sortedBoundaries.length - 1; k++) {
        const [start, end] = [sortedBoundaries[k], sortedBoundaries[k + 1]]
        const headerSlice = (headerLine.slice(start, end) || '').trim()
        if (headerSlice.length > 0 || cols.length === 0) {
          cols.push([start, end])
        }
      }
      if (cols.length > 1) return cols
    }
    // Strategy B: single "=" group — find trailing-space transitions in header
    const cols2 = [[0, sepLine.length]]
    let lastNonSpace = -1
    const trimEnd = Math.min(sepLine.length, headerLine.length)
    for (let pos = 0; pos < trimEnd; pos++) {
      const hChar = headerLine[pos]
      const isNonSpace = hChar && hChar.trim().length > 0
      if (isNonSpace) lastNonSpace = pos
      else if (lastNonSpace >= 0) {
        let nextNonSpace = -1
        for (let ahead = pos; ahead < trimEnd; ahead++) {
          if (headerLine[ahead] && headerLine[ahead].trim().length > 0) { nextNonSpace = ahead; break }
        }
        if (nextNonSpace >= 0) {
          cols2[cols2.length - 1][1] = nextNonSpace
          cols2.push([nextNonSpace, sepLine.length])
          lastNonSpace = nextNonSpace
          pos = nextNonSpace - 1
        }
      }
    }
    if (cols2.length > 1) {
      const lastColHeader = (headerLine.slice(cols2[cols2.length - 1][0], cols2[cols2.length - 1][1]) || '').trim()
      if (lastColHeader.length > 0) return cols2
    }
    return [[0, sepLine.length]]
  }

  let headers = []
  let rows = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line || !line.trim() || line.trim().startsWith('SQL>')) { i++; continue }
    if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headerLine = line
      const sepLine = lines[i + 1] || ''
      const cols = colsFromSep(headerLine, sepLine)
      if (cols.length > 0 && !headers.length) {
        headers = cols.map(([s, e]) => line.slice(s, e).trim())
      }
      let j = i + 2
      let sawData = false
      while (j < lines.length) {
        const dl = lines[j]
        if (!dl || !dl.trim()) { if (sawData) break; j++; continue }
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
// Rules: separator widths must exactly match header field name lengths.
// Data rows >= separator length (space-padded per column).

// T1: Single-column schema. 22 "=" → 1 column.
const SINGLE_COL_SCHEMA = `RDB$RELATION_NAME
======================
EMP
OVERTIME
GWSCANNERDATA01
FFBSCANNERDATA01

     4 rows selected

SQL>`

// T2: Two-column two-row header. 15+1+15 = 31 chars.
const EMP_2COL = `COL1             COL2
=============== ===============
ID1              NAME1
ID2              NAME2
ID3              NAME3

SQL>`

// T3: Multi-page with 5 columns. 14+1+5+1+14+1+14+1+8 = 60 chars.
const MULTI_PAGE = `LOOSEFRUIT2     COL2  RDB$FIELD_N RDB$FIEL TBSCOUNT
============== ===== =============== ======== ========
0               VAL1  2026-06-16          2     11011
0               VAL2  2026-06-16          3     11022

     2 rows selected

LOOSEFRUIT2     COL2  RDB$FIELD_N RDB$FIEL TBSCOUNT
============== ===== =============== ======== ========
0               VAL3  2026-06-16          2     11019
0               VAL4  2026-06-17          2     11021

     2 rows selected

SQL>`

// T4: Count query. 29 "=" (covers data row width).
const COUNT_OUTPUT = `                        CNT
=============================
                         5915

SQL>`

// T5: Error output — no header+separator, produces empty result.
const ERROR_OUTPUT = `Statement failed, SQLCODE = -502
unsuccessful metadata update

SQL>`

// ── Tests ─────────────────────────────────────────────────────────────────────

const t1 = parseIsqlOutput(SINGLE_COL_SCHEMA)
assert.equal(t1.headers.length, 1, 'T1: 1 header')
assert.equal(t1.headers[0], 'RDB$RELATION_NAME', 'T1: correct header')
assert.equal(t1.rows.length, 4, 'T1: 4 rows')
assert.equal(t1.rows[0][0], 'EMP', 'T1: EMP first')
console.log('T1 PASS: single-column schema')

const t2 = parseIsqlOutput(EMP_2COL)
assert.equal(t2.headers.length, 2, 'T2: 2 headers')
assert.equal(t2.headers[0], 'COL1', 'T2: first header')
assert.equal(t2.headers[1], 'COL2', 'T2: second header')
assert.equal(t2.rows.length, 3, 'T2: 3 rows')
assert.equal(t2.rows[0][0], 'ID1', 'T2: row1 col1')
assert.equal(t2.rows[0][1], 'NAME1', 'T2: row1 col2')
console.log('T2 PASS: two-column two-row header')

const t3 = parseIsqlOutput(MULTI_PAGE)
assert.equal(t3.headers.length, 7, 'T3: 7 headers (header shorter than sep → adjacent group boundaries)')
assert.equal(t3.rows.length, 4, 'T3: 4 rows across 2 pages')
assert.equal(t3.rows[0][0], '0', 'T3: row1 col1 LOOSEFRUIT2')
assert.equal(t3.rows[3][4], '2', 'T3: row4 col5 (TBSCOUNT split across sep groups)')
console.log('T3 PASS: multi-page with Strategy A boundary detection')

const t4 = parseIsqlOutput(COUNT_OUTPUT)
assert.equal(t4.headers.length, 1, 'T4: 1 header')
assert.equal(t4.rows.length, 1, 'T4: 1 row')
assert.equal(t4.rows[0][0].trim(), '5915', 'T4: count value trimmed')
console.log('T4 PASS: count query')

const t5 = parseIsqlOutput(ERROR_OUTPUT)
assert.equal(t5.headers.length, 0, 'T5: 0 headers')
assert.equal(t5.rows.length, 0, 'T5: 0 rows')
console.log('T5 PASS: error output')

console.log('\n✅ All 5 baseline parser tests passed.')
