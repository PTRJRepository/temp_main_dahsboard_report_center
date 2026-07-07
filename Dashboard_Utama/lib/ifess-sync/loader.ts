// loader.ts — server-side load into rebinmas_ifess_migrated.
// ensureTargetTable: idempotent CREATE (mirror FB_Migration schema.js) + division/batch cols + index.
// bulkInsertChunk: mssql Table bulk insert with division_code + migration_batch_id tagging (mirror client.js bulkLoad).
import sql from 'mssql'
import { getMigratedPool, toMssqlType, coerceCell } from '@/lib/utils/migratedDb'

export interface SqlsCol { name: string; sqlsType: string; nullable: boolean }

// Idempotent target table. sqlsCols = source-mirrored cols (NOT including division/batch — those are appended).
// All source cols created NULLABLE: FB NOT NULL flag unreliable post-isql-text-reconstruction (matches FB_Migration).
export async function ensureTargetTable(tableName: string, sqlsCols: SqlsCol[]): Promise<void> {
  const pool = await getMigratedPool()
  const colDefs = sqlsCols.map(c => `[${c.name}] ${c.sqlsType} NULL`).join(', ')
  // brackets guard reserved words / odd names. Index name truncated to avoid 128-char limit on long tables.
  const idxName = `IX_${tableName}`.slice(0, 120)
  const ddl = `
IF OBJECT_ID(N'dbo.[${tableName}]') IS NULL
BEGIN
  CREATE TABLE dbo.[${tableName}] (
    ${colDefs},
    division_code VARCHAR(8) NOT NULL,
    migration_batch_id BIGINT NOT NULL
  );
  CREATE INDEX [${idxName}] ON dbo.[${tableName}](division_code, migration_batch_id);
END`
  await pool.request().query(ddl)
}

// Bulk insert one chunk. rows = array of arrays (raw strings, aligned to cols). Tags appended per row.
// Coerces each cell via coerceCell so mssql driver gets typed values. Returns rows inserted.
export async function bulkInsertChunk(
  tableName: string,
  cols: SqlsCol[],
  rows: (string | null)[][],
  { divisionCode, batchId }: { divisionCode: string; batchId: number },
): Promise<number> {
  if (!rows.length) return 0
  const pool = await getMigratedPool()
  const table = new sql.Table(tableName)
  table.create = false
  for (const c of cols) {
    table.columns.add(c.name, toMssqlType(c.sqlsType), { nullable: true })
  }
  table.columns.add('division_code', sql.VarChar(8), { nullable: false })
  table.columns.add('migration_batch_id', sql.BigInt, { nullable: false })

  for (const r of rows) {
    const coerced = cols.map((c, i) => coerceCell(r[i] ?? null, c.sqlsType) as string | number | boolean | Date | Buffer | null)
    table.rows.add(...coerced, divisionCode, batchId)
  }

  let lastErr: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pool.request().bulk(table)
      return rows.length
    } catch (e) {
      lastErr = e
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  throw lastErr
}

// Delete rows of a batch (for retry/replace semantics). Mirror schema.js deleteBatchRows.
export async function deleteBatchRows(tableName: string, batchId: number, divisionCode: string): Promise<void> {
  const pool = await getMigratedPool()
  await pool.request()
    .input('b', sql.BigInt, batchId)
    .input('d', sql.VarChar(8), divisionCode)
    .query(`DELETE FROM dbo.[${tableName}] WHERE migration_batch_id=@b AND division_code=@d`)
}
