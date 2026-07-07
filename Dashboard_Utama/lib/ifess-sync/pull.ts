// pull.ts — SERVER-PULL sync orchestrator.
// Server actively asks each client for its latest data: read watermark → build incremental
// SELECT → dispatch EXECUTE_FIREBIRD_QUERY to the client via the gateway → poll the job result
// → bulk-insert rows into rebinmas_ifess_migrated → advance the watermark.
// The client is passive: it only answers queries (QueryGateway, unchanged). All sync logic
// lives here on the server.
import sql from 'mssql'
import { getMigratedPool, toSqlsCol } from '@/lib/utils/migratedDb'
import { ensureTargetTable, bulkInsertChunk, type SqlsCol } from '@/lib/ifess-sync/loader'

const GATEWAY_BASE = process.env.GATEWAY_BASE || 'http://localhost:3002'
const IFESS_API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul'
const DATE_COL_RE = /^(TRANS|INP|SCAN|EFF|CREATED|INPUT|JOIN|POSTED).*DATE$/i

export interface PullResult { division: string; table: string; status: string; rowsLoaded: number; pages: number; watermark?: string | null; error?: string }

const PAGE_SIZE = 2000  // rows per dispatch — bounds gateway result memory (no OOM on millions)
const MAX_PAGES = 10000 // backstop (PAGE_SIZE * MAX_PAGES = 20M rows)

// Pull one (division, table) from one client. Server actively asks for data in PAGES via the
// watermark: each page is `SELECT FIRST N ... WHERE wm > last ORDER BY wm`, dispatched to the
// client as an EXECUTE_FIREBIRD_QUERY, bulk-inserted, then the watermark advances. Loop until
// a page returns < PAGE_SIZE (no more new rows). This bounds memory — millions of rows never
// sit in one JSON result; each page is ≤ PAGE_SIZE.
export async function pullTable(division: string, table: string, clientId: string): Promise<PullResult> {
  const pool = await getMigratedPool()
  try {
    const wm = await getOrDetectWatermark(pool, division, table, clientId)
    if (!wm.col) return { division, table, status: 'unsyncable', rowsLoaded: 0, pages: 0 }

    const cols = await fetchColumns(table, clientId)
    const nonBlobCols = cols.filter(c => c.type !== 261)
    const colList = nonBlobCols.map(c => `"${c.name}"`).join(', ')
    const sqlsCols: SqlsCol[] = nonBlobCols.map(c => toSqlsCol(c))
    await ensureTargetTable(table, sqlsCols)

    let last = wm.lastValue
    let totalLoaded = 0
    let pages = 0
    for (pages = 1; pages <= MAX_PAGES; pages++) {
      const where = last ? `WHERE "${wm.col}" > '${last.replace(/'/g, "''")}'` : ''
      // FIRST N bounds the page; ORDER BY wm keeps it deterministic + lets us advance the watermark.
      const queryText = `SELECT FIRST ${PAGE_SIZE} ${colList} FROM "${table}" ${where} ORDER BY "${wm.col}"`
      const batch = await dispatchQuery(queryText, clientId)
      const result = await pollBatchResult(batch.queryBatchId)

      const rowsArr: (string | null)[][] = (result.rows || []).map((r: Record<string, unknown>) =>
        nonBlobCols.map(c => cellToString(r[c.name])))
      if (rowsArr.length === 0) break // no more new rows

      const batchId = Math.floor(Date.now() / 1000) + pages * 1000 + Math.floor(Math.random() * 999)
      // bulk-insert in sub-chunks (mssql Table size guard)
      const CHUNK = 500
      for (let i = 0; i < rowsArr.length; i += CHUNK) {
        totalLoaded += await bulkInsertChunk(table, sqlsCols, rowsArr.slice(i, i + CHUNK), { divisionCode: division, batchId })
      }
      // advance watermark = max(wm) of this page's loaded rows
      const adv = await pool.request()
        .input('b', sql.BigInt, batchId).input('d', sql.VarChar(8), division)
        .query(`SELECT MAX([${wm.col}]) AS M FROM dbo.[${table}] WHERE migration_batch_id=@b AND division_code=@d`)
      const maxVal = adv.recordset[0]?.M
      if (maxVal == null) break
      last = maxVal instanceof Date ? (maxVal as Date).toISOString().slice(0, 19).replace('T', ' ') : String(maxVal)
      await upsertWatermark(pool, division, table, wm.col, last, 'active')

      if (rowsArr.length < PAGE_SIZE) break // last page (partial) — done
    }
    return { division, table, status: 'success', rowsLoaded: totalLoaded, pages, watermark: last }
  } catch (e: any) {
    return { division, table, status: 'failed', rowsLoaded: 0, pages: 0, error: e.message }
  }
}

// --- helpers ---

async function getOrDetectWatermark(pool: sql.ConnectionPool, division: string, table: string, clientId: string): Promise<{ col: string | null; lastValue: string | null }> {
  const r = await pool.request()
    .input('d', sql.VarChar(8), division).input('t', sql.VarChar(64), table)
    .query('SELECT watermark_col, last_value FROM dbo.sync_watermarks WHERE division_code=@d AND table_name=@t')
  const row = r.recordset[0]
  if (row?.watermark_col) return { col: row.watermark_col, lastValue: row.last_value }
  // detect — schema from the CLIENT's DB (matches the estate that answers data queries)
  const cols = await fetchColumns(table, clientId)
  const dateCol = cols.find(c => DATE_COL_RE.test(c.name))
  const idCol = cols.find(c => /^ID$/i.test(c.name)) || cols.find(c => /ID$/i.test(c.name))
  const col = dateCol?.name || idCol?.name || cols[0]?.name || null
  if (!col) { await upsertWatermark(pool, division, table, null, null, 'unsyncable'); return { col: null, lastValue: null } }
  // initial last_value = max on target (post-bootstrap) or null
  const m = await pool.request()
    .input('d', sql.VarChar(8), division).query(`SELECT MAX([${col}]) AS M FROM dbo.[${table}] WHERE division_code=@d`)
  const mv = m.recordset[0]?.M
  const last = mv == null ? null : (mv instanceof Date ? (mv as Date).toISOString().slice(0, 19).replace('T', ' ') : String(mv))
  await upsertWatermark(pool, division, table, col, last, 'active')
  return { col, lastValue: last }
}

async function upsertWatermark(pool: sql.ConnectionPool, division: string, table: string, col: string | null, val: string | null, status: string) {
  await pool.request()
    .input('d', sql.VarChar(8), division).input('t', sql.VarChar(64), table)
    .input('c', sql.VarChar(64), col).input('v', sql.NVarChar(64), val)
    .input('s', sql.VarChar(16), status).input('now', sql.DateTime2, new Date())
    .query(`IF EXISTS (SELECT 1 FROM dbo.sync_watermarks WHERE division_code=@d AND table_name=@t)
      UPDATE dbo.sync_watermarks SET watermark_col=@c, last_value=@v, last_sync_at=@now, status=@s WHERE division_code=@d AND table_name=@t
      ELSE INSERT INTO dbo.sync_watermarks(division_code, table_name, watermark_col, last_value, last_sync_at, status) VALUES(@d,@t,@c,@v,@now,@s)`)
}

// FB column descriptors — dispatched to the CLIENT (not the server DB) so the schema matches
// the estate that will answer the data query. exec-sync reads the SERVER's DB; for the client
// we dispatch an EXECUTE_FIREBIRD_QUERY and read the result rows.
async function fetchColumns(table: string, clientId: string): Promise<{ name: string; type: number; length: number; subtype: number; nullable: boolean }[]> {
  const sqlText = `SELECT rf.RDB\$FIELD_NAME, f.RDB\$FIELD_TYPE, f.RDB\$FIELD_LENGTH, f.RDB\$FIELD_SUB_TYPE, rf.RDB\$NULL_FLAG
    FROM RDB\$RELATION_FIELDS rf JOIN RDB\$FIELDS f ON f.RDB\$FIELD_NAME = rf.RDB\$FIELD_SOURCE
    WHERE rf.RDB\$RELATION_NAME = '${table.replace(/'/g, "''")}' ORDER BY rf.RDB\$FIELD_POSITION`
  const batch = await dispatchQuery(sqlText, clientId)
  const result = await pollBatchResult(batch.queryBatchId)
  return (result.rows || []).map((row: Record<string, unknown>) => {
    const v = (k: string) => row[k] == null ? '' : String(row[k])
    return {
      name: v('FIELD_NAME').trim() || v(Object.keys(row)[0]).trim(),
      type: parseInt(v('FIELD_TYPE')) || 0,
      length: parseInt(v('FIELD_LENGTH')) || 0,
      subtype: parseInt(v('FIELD_SUB_TYPE')) || 0,
      nullable: parseInt(v('NULL_FLAG')) !== 1,
    }
  })
}

async function dispatchQuery(queryText: string, clientId: string): Promise<{ queryBatchId: string }> {
  const r = await fetch(`${GATEWAY_BASE}/api/ifess/query-gateway/dispatch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': IFESS_API_KEY },
    body: JSON.stringify({ queryText, targetMode: 'SingleClient', targetClientIds: [clientId], maxRows: PAGE_SIZE, timeoutSeconds: 120 })
  })
  const j = await r.json()
  if (!j.success) throw new Error('dispatch failed: ' + (j.error || ''))
  return { queryBatchId: j.queryBatchId }
}

async function pollBatchResult(batchId: string, timeoutMs = 90000): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await fetch(`${GATEWAY_BASE}/api/ifess/query-gateway/batches/${batchId}`, { headers: { 'X-API-Key': IFESS_API_KEY } })
    const j = await r.json()
    const job = (j.jobs || [])[0]
    if (job?.status === 'Success') {
      const results = j.results || []
      const res = results[0]
      return { headers: res?.headers || [], rows: res?.rows || [] }
    }
    if (job?.status === 'Failed') throw new Error('client query failed: ' + (job.errorMessage || ''))
    await new Promise(res => setTimeout(res, 500))
  }
  throw new Error('poll timeout for batch ' + batchId)
}

function cellToString(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ')
  return String(v)
}
