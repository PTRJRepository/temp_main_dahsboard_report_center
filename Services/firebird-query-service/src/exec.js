import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// ── Configuration (injected from index.js or environment) ──────────────────────
export const LOCAL_ISQL = process.env.ISQL_PATH || 'C:\\Program Files (x86)\\Firebird\\Firebird_1_5\\bin\\isql.exe';
export const LOCAL_DB   = process.env.FIREBIRD_DB_PATH || 'D:\\Gawean Rebinmas\\Monitoring Database\\Database Ifess\\IFESS_ARE_C_28-06-2026 (1)\\PTRJ_ARC.FDB';
export const LOCAL_FB_USER = process.env.FB_USER || 'SYSDBA';
export const LOCAL_FB_PASS = process.env.FB_PASS || 'masterkey';

// ── isql output parser ─────────────────────────────────────────────────────────
// Golden tests: tests/baseline/firebird-parse-isql.test.js
// Key facts (verified against real isql output from PTRJ_ARC.FDB):
//   - isql paginates ~20 rows/page: header + sep(===) + data + blank.
//   - Fixed-width columns: values space-padded. headers[i] = headerLine.slice(s,e).trim()
//   - colsFromSep() derives [start,end) boundaries from BOTH header + separator:
//       Strategy A: sep has multiple "=" groups → space between groups = boundary
//       Strategy B: sep has one "=" group → trailing-space transitions in header
//   - Multi-page: loop all lines, detect header+sep, collect rows until blank/separator,
//     then CONTINUE (don't break) to merge pages.

/**
 * @param {string} output  — raw isql stdout
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseIsqlOutput(output) {
    const lines = output.split(/\r?\n/).map(l => l.replace(/\r$/, ''));
    const isSeparator = (l) => /^[=\s]+$/.test((l || '').trim()) && (l || '').includes('=');

    /**
     * Derive column [start, end) boundaries from header + separator lines.
     * Detects two isql formats:
     *   A) Narrow: header "col1    col2   col3", sep "==== === ==="
     *      → spaces in sep mark boundaries. Validated with header non-space check.
     *   B) Wide: header "col1<wide>col2<wide>col3" (truncated names), sep "==============="
     *      → one long "=" group. Find header non-space → space → non-space transitions.
     */
    const colsFromSep = (headerLine, sepLine) => {
        // Strategy A: if sepLine has multiple "=" groups separated by spaces,
        // those spaces are column boundaries. Validate with header non-space check.
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
            // Strategy A: space-separated "=" groups. Spaces between groups = column boundaries.
            // Validate: each boundary should have non-space content in header on both sides.
            const boundaries = new Set([0]);
            for (let k = 0; k < sepGroups.length - 1; k++) {
                boundaries.add(sepGroups[k][1]);    // end of group k = boundary
                boundaries.add(sepGroups[k + 1][0]); // start of group k+1 = boundary
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

        // Strategy B: single "=" group (wide header). Find column transitions in header:
        // non-space → space → non-space means a column boundary.
        // Scan header for trailing spaces within the separator range.
        const cols2 = [[0, sepLine.length]];
        let lastNonSpace = -1;
        const trimEnd = Math.min(sepLine.length, headerLine.length);
        for (let pos = 0; pos < trimEnd; pos++) {
            const hChar = headerLine[pos];
            const isNonSpace = hChar && hChar.trim().length > 0;
            if (isNonSpace) {
                lastNonSpace = pos;
            } else if (lastNonSpace >= 0) {
                // found a trailing-space position: look ahead for next non-space
                let nextNonSpace = -1;
                for (let ahead = pos; ahead < trimEnd; ahead++) {
                    if (headerLine[ahead] && headerLine[ahead].trim().length > 0) {
                        nextNonSpace = ahead;
                        break;
                    }
                }
                if (nextNonSpace >= 0) {
                    // trailing-space zone ends at the column boundary (nextNonSpace)
                    // Close current column, start new one
                    cols2[cols2.length - 1][1] = nextNonSpace;
                    cols2.push([nextNonSpace, sepLine.length]);
                    lastNonSpace = nextNonSpace;
                    // Skip past the non-space we just found to avoid re-triggering
                    pos = nextNonSpace - 1;
                }
            }
        }
        // Only accept multiple cols if the split actually produces content on both sides
        if (cols2.length > 1) {
            const lastColHeader = (headerLine.slice(cols2[cols2.length - 1][0], cols2[cols2.length - 1][1]) || '').trim();
            if (lastColHeader.length > 0) return cols2;
        }
        // Fallback: single column (original behavior)
        return [[0, sepLine.length]];
    };

    let headers = [];
    let rows = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line || !line.trim() || line.trim().startsWith('SQL>')) { i++; continue; }
        // header candidate: this line + next is separator
        if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
            const headerLine = line;
            const sepLine = lines[i + 1] || '';
            const cols = colsFromSep(headerLine, sepLine);
            if (cols.length > 0 && !headers.length) {
                headers = cols.map(([s, e]) => headerLine.slice(s, e).trim());
            }
            // collect data rows — skip leading blanks (isql puts blank between separator and data)
            let j = i + 2;
            let sawData = false;
            while (j < lines.length) {
                const dl = lines[j];
                // blank line: skip if before data, break if after data (end of page)
                if (!dl || !dl.trim()) {
                    if (sawData) break;
                    j++; continue;
                }
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

// ── Serialization queue ────────────────────────────────────────────────────────
// Firebird 1.5 fbserver is single-threaded: concurrent isql sessions serialize at
// the DB and cascade-timeout (one slow query holds the lock, others wait past 60s).
// Serialize isql execution in-process — at most one query runs at a time.
// Promise chain queue. Invariant: only one isql at a time.
let _isqlChain = Promise.resolve();

export function withIsqlLock(fn) {
    const next = _isqlChain.then(fn, fn);
    _isqlChain = next.catch(() => {});
    return next;
}

// ── Query counter for unique temp filenames ────────────────────────────────────
let _seq = 0;

// ── Execute a Firebird query via isql.exe shell-out ───────────────────────────
/**
 * Execute a read-only query against Firebird via isql.exe.
 *
 * Invariants preserved:
 *   1. Only one isql execution concurrent (withIsqlLock)
 *   2. Unique temp filenames (collision-resistant: Date.now + pid + _seq)
 *   3. Temp files cleaned after success / failure / timeout (finally block)
 *   4. Hung process terminated without blocking queue (20s timeout → taskkill orphans)
 *   5. Read-only validation enforced by caller (isReadOnlySql) before this call
 *
 * @param {string} queryText
 * @param {number} [maxRows]
 * @returns {Promise<{ ok: boolean, headers: string[], rows: string[][], rowCount: number, raw: string, error?: string }>}
 */
export async function execLocalQuery(queryText, maxRows) {
    _seq = (_seq || 0) + 1;
    const tmpSql = join(tmpdir(), `ifess_exec_${Date.now()}_${process.pid}_${_seq}.sql`);

    let sql = queryText.trim();
    // Inject SELECT FIRST N unless already present
    if (!/^SELECT FIRST/i.test(sql) && maxRows) {
        sql = sql.replace(/^SELECT/i, `SELECT FIRST ${maxRows}`);
    }

    writeFileSync(tmpSql, sql + ';\nquit;\n');

    // Serialized: only one isql runs at a time. Prevents Firebird lock-cascade timeouts.
    return withIsqlLock(() => {
        try {
            // execFileSync returns isql stdout reliably under Bun.
            // Timeout 20s: a stuck isql must fail FAST so the queue frees for the next query.
            // A pinned fbserver lock blocks every subsequent query; on ETIMEDOUT we taskkill orphans.
            const out = execFileSync(LOCAL_ISQL, [
                `localhost:${LOCAL_DB}`,
                '-u', LOCAL_FB_USER,
                '-p', LOCAL_FB_PASS,
                '-q', '-i', tmpSql
            ], {
                encoding: 'utf8',
                timeout: 20000,
                maxBuffer: 100 * 1024 * 1024
            });

            const parsed = parseIsqlOutput(out);
            return { ok: true, ...parsed, rowCount: parsed.rows.length, raw: out };
        } catch (e) {
            // On ANY isql failure (timeout or otherwise), kill ALL isql.exe immediately.
            // Don't wait 60s for the OS to release the pin. Raze orphan now.
            try {
                spawnSync('taskkill', ['/IM', 'isql.exe', '/F'], { windowsHide: true, timeout: 5000 });
            } catch { /* best-effort */ }
            return {
                ok: false,
                error: String(e && e.message || e),
                headers: [],
                rows: [],
                rowCount: 0,
                raw: ''
            };
        } finally {
            // Always clean up temp file
            try { unlinkSync(tmpSql); } catch { /* best-effort */ }
        }
    });
}
