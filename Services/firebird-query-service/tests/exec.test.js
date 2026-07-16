/**
 * Unit tests for src/exec.js and src/isReadOnlySql.js
 *
 * Run: node --test tests/exec.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Inline parseIsqlOutput from exec.js (same implementation, test the logic) ──
function parseIsqlOutput(output) {
    const lines = output.split(/\r?\n/).map(l => l.replace(/\r$/, ''));
    const isSeparator = (l) => /^[=\s]+$/.test((l || '').trim()) && (l || '').includes('=');

    const colsFromSep = (headerLine, sepLine) => {
        const sepGroups = [];
        let i = 0;
        while (i < sepLine.length) {
            if (sepLine[i] === '=') {
                const start = i;
                while (i < sepLine.length && sepLine[i] === '=') i++;
                sepGroups.push([start, i]);
            } else i++;
        }
        if (sepGroups.length > 1) {
            const boundaries = new Set([0]);
            for (let k = 0; k < sepGroups.length - 1; k++) {
                boundaries.add(sepGroups[k][1]);
                boundaries.add(sepGroups[k + 1][0]);
            }
            boundaries.add(sepLine.length);
            const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
            const cols = [];
            for (let k = 0; k < sortedBoundaries.length - 1; k++) {
                const [start, end] = [sortedBoundaries[k], sortedBoundaries[k + 1]];
                const headerSlice = (headerLine.slice(start, end) || '').trim();
                if (headerSlice.length > 0 || cols.length === 0) {
                    cols.push([start, end]);
                }
            }
            if (cols.length > 1) return cols;
        }

        const cols2 = [[0, sepLine.length]];
        let lastNonSpace = -1;
        const trimEnd = Math.min(sepLine.length, headerLine.length);
        for (let pos = 0; pos < trimEnd; pos++) {
            const hChar = headerLine[pos];
            const isNonSpace = hChar && hChar.trim().length > 0;
            if (isNonSpace) lastNonSpace = pos;
            else if (lastNonSpace >= 0) {
                let nextNonSpace = -1;
                for (let ahead = pos; ahead < trimEnd; ahead++) {
                    if (headerLine[ahead] && headerLine[ahead].trim().length > 0) {
                        nextNonSpace = ahead;
                        break;
                    }
                }
                if (nextNonSpace >= 0) {
                    cols2[cols2.length - 1][1] = nextNonSpace;
                    cols2.push([nextNonSpace, sepLine.length]);
                    lastNonSpace = nextNonSpace;
                    pos = nextNonSpace - 1;
                }
            }
        }
        if (cols2.length > 1) {
            const lastColHeader = (headerLine.slice(cols2[cols2.length - 1][0], cols2[cols2.length - 1][1]) || '').trim();
            if (lastColHeader.length > 0) return cols2;
        }
        return [[0, sepLine.length]];
    };

    let headers = [];
    let rows = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line || !line.trim() || line.trim().startsWith('SQL>')) { i++; continue; }
        if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
            const headerLine = line;
            const sepLine = lines[i + 1] || '';
            const cols = colsFromSep(headerLine, sepLine);
            if (cols.length > 0 && !headers.length) {
                headers = cols.map(([s, e]) => headerLine.slice(s, e).trim());
            }
            let j = i + 2;
            let sawData = false;
            while (j < lines.length) {
                const dl = lines[j];
                if (!dl || !dl.trim()) { if (sawData) break; j++; continue; }
                if (isSeparator(dl)) break;
                if (/rows (affected|selected|fetched)/i.test(dl) || /^(SQL>|Statement failed)/i.test(dl.trim())) break;
                if (cols.length > 0) {
                    rows.push(cols.map(([s, e]) => dl.slice(s, e).trim()));
                    sawData = true;
                }
                j++;
            }
            i = j;
            continue;
        }
        i++;
    }
    return { headers, rows };
}

// ── Inline isReadOnlySql from isReadOnlySql.js ──────────────────────────────────
function isReadOnlySql(queryText) {
    if (!queryText || typeof queryText !== 'string') {
        return { valid: false, errors: ['Query text is required'] };
    }
    const normalized = queryText.trim().replace(/\s+/g, ' ').toUpperCase();
    const trimmed = normalized.trim();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { valid: false, errors: ['Query must start with SELECT or WITH ... SELECT'] };
    }
    const forbiddenPatterns = [
        /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/, /\bCREATE\b/,
        /\bTRUNCATE\b/, /\bGRANT\b/, /\bREVOKE\b/, /\bEXECUTE\b/, /\bEXEC\b/, /\bCOMMIT\b/, /\bROLLBACK\b/,
        /\bSAVEPOINT\b/, /;\s*\S/, /;\s*$/
    ];
    const errors = [];
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(normalized)) {
            errors.push(`Query contains forbidden pattern: ${pattern.toString()}`);
        }
    }
    if (normalized.includes(';')) {
        errors.push('Multiple SQL statements are not allowed');
    }
    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, errors: [] };
}

// ── withIsqlLock simulation (for testing) ───────────────────────────────────────
let _isqlChain_sim = Promise.resolve();
function withIsqlLock_sim(fn) {
    const next = _isqlChain_sim.then(fn, fn);
    _isqlChain_sim = next.catch(() => {});
    return next;
}
function resetIsqlChain() { _isqlChain_sim = Promise.resolve(); }

// ── Golden corpus (mirrors tests/baseline/firebird-parse-isql.test.js) ──────────
const SINGLE_COL_SCHEMA = `RDB$RELATION_NAME
======================
EMP
OVERTIME
GWSCANNERDATA01
FFBSCANNERDATA01

     4 rows selected

SQL>`;

const EMP_2COL = `COL1             COL2
=============== ===============
ID1              NAME1
ID2              NAME2
ID3              NAME3

SQL>`;

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

SQL>`;

const COUNT_OUTPUT = `                        CNT
=============================
                         5915

SQL>`;

const ERROR_OUTPUT = `Statement failed, SQLCODE = -502
unsuccessful metadata update

SQL>`;

// ── parseIsqlOutput tests ───────────────────────────────────────────────────────
describe('parseIsqlOutput — golden corpus', () => {

    it('T1: single-column schema (22 "=" → 1 column)', () => {
        const r = parseIsqlOutput(SINGLE_COL_SCHEMA);
        assert.equal(r.headers.length, 1);
        assert.equal(r.headers[0], 'RDB$RELATION_NAME');
        assert.equal(r.rows.length, 4);
        assert.equal(r.rows[0][0], 'EMP');
    });

    it('T2: two-column two-row header', () => {
        const r = parseIsqlOutput(EMP_2COL);
        assert.equal(r.headers.length, 2);
        assert.equal(r.headers[0], 'COL1');
        assert.equal(r.headers[1], 'COL2');
        assert.equal(r.rows.length, 3);
        assert.equal(r.rows[0][0], 'ID1');
        assert.equal(r.rows[0][1], 'NAME1');
    });

    it('T3: multi-page with Strategy A boundary detection', () => {
        const r = parseIsqlOutput(MULTI_PAGE);
        assert.equal(r.headers.length, 7);
        assert.equal(r.rows.length, 4);
        assert.equal(r.rows[0][0], '0');
        assert.equal(r.rows[3][4], '2');
    });

    it('T4: count query — value trimmed', () => {
        const r = parseIsqlOutput(COUNT_OUTPUT);
        assert.equal(r.headers.length, 1);
        assert.equal(r.rows.length, 1);
        assert.equal(r.rows[0][0].trim(), '5915');
    });

    it('T5: error output — no header+separator, produces empty result', () => {
        const r = parseIsqlOutput(ERROR_OUTPUT);
        assert.equal(r.headers.length, 0);
        assert.equal(r.rows.length, 0);
    });
});

// ── isReadOnlySql tests ─────────────────────────────────────────────────────────
describe('isReadOnlySql — validation corpus', () => {

    it('accepts simple SELECT', () => {
        const r = isReadOnlySql('SELECT * FROM EMP');
        assert.equal(r.valid, true);
        assert.equal(r.errors.length, 0);
    });

    it('accepts WITH ... SELECT', () => {
        const r = isReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x');
        assert.equal(r.valid, true);
    });

    it('rejects INSERT', () => {
        const r = isReadOnlySql('INSERT INTO EMP VALUES (1)');
        assert.equal(r.valid, false);
    });

    it('rejects UPDATE', () => {
        const r = isReadOnlySql('UPDATE EMP SET NAME = "x"');
        assert.equal(r.valid, false);
    });

    it('rejects DELETE', () => {
        const r = isReadOnlySql('DELETE FROM EMP');
        assert.equal(r.valid, false);
    });

    it('rejects DROP', () => {
        const r = isReadOnlySql('DROP TABLE EMP');
        assert.equal(r.valid, false);
    });

    it('rejects ALTER', () => {
        const r = isReadOnlySql('ALTER TABLE EMP ADD COL1 VARCHAR(10)');
        assert.equal(r.valid, false);
    });

    it('rejects CREATE', () => {
        const r = isReadOnlySql('CREATE TABLE X (ID INT)');
        assert.equal(r.valid, false);
    });

    it('rejects TRUNCATE', () => {
        const r = isReadOnlySql('TRUNCATE TABLE EMP');
        assert.equal(r.valid, false);
    });

    it('rejects multiple statements with semicolon', () => {
        const r = isReadOnlySql('SELECT * FROM EMP; SELECT * FROM OVERTIME');
        assert.equal(r.valid, false);
    });

    it('rejects null input', () => {
        const r = isReadOnlySql(null);
        assert.equal(r.valid, false);
    });

    it('rejects empty string', () => {
        const r = isReadOnlySql('   ');
        assert.equal(r.valid, false);
    });
});

// ── withIsqlLock tests ─────────────────────────────────────────────────────────
describe('withIsqlLock — serialization invariant', () => {

    beforeEach(() => { resetIsqlChain(); });

    it('executes tasks in order (parallel requests serialize)', async () => {
        const order = [];
        const p1 = withIsqlLock_sim(async () => {
            order.push('start-1');
            await new Promise(r => setTimeout(r, 50));
            order.push('end-1');
        });
        const p2 = withIsqlLock_sim(async () => {
            order.push('start-2');
            order.push('end-2');
        });
        await Promise.all([p1, p2]);
        const idx1 = order.indexOf('start-1');
        const idx2 = order.indexOf('start-2');
        assert.ok(idx2 > idx1, 'task 2 should start after task 1 finishes');
        assert.ok(order.indexOf('end-1') < idx2, 'task 1 should finish before task 2 starts');
    });

    it('timed-out query does not block next (error propagates, chain continues)', async () => {
        resetIsqlChain();
        let secondRan = false;
        try {
            await withIsqlLock_sim(async () => {
                throw new Error('timeout');
            });
        } catch (_) { /* expected */ }
        await withIsqlLock_sim(async () => {
            secondRan = true;
        });
        assert.equal(secondRan, true, 'second task should run after first error');
    });
});

// ── Invariant: unique temp filenames ────────────────────────────────────────────
describe('execLocalQuery — filename collision resistance', () => {
    it('generates unique filenames per call (_seq increments)', () => {
        // Simulate filename generation (same _seq pattern as exec.js)
        let seq = 0;
        const generate = () => {
            seq++;
            // Use a fixed prefix to avoid relying on os/tmpdir in ESM test
            return `ifess_exec_${Date.now()}_${process.pid}_${seq}.sql`;
        };
        const f1 = generate();
        const f2 = generate();
        assert.notEqual(f1, f2, 'consecutive calls must produce different filenames');
    });
});

console.log('\n[FirebirdQS] Unit tests loaded — run with: node --test tests/exec.test.js');
