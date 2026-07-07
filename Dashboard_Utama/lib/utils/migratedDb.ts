// migratedDb.ts — second mssql singleton pool, target = rebinmas_ifess_migrated.
// Parallel to lib/utils/db.ts (which targets extend_db_ptrj). Same host, different DB.
// FB sync rows are written here with division_code + migration_batch_id tagging.
import sql, { ConnectionPool } from 'mssql'

const config: sql.config = {
  server: process.env.MSSQL_HOST || '10.0.0.110',
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'ptrj@123',
  database: process.env.MSSQL_MIGRATED_DB || 'rebinmas_ifess_migrated',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: parseInt(process.env.MSSQL_CONNECTION_TIMEOUT_MS || '5000'),
  requestTimeout: parseInt(process.env.MSSQL_REQUEST_TIMEOUT_MS || '60000'),
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
}

class MigratedDb {
  private static instance: MigratedDb
  private pool: ConnectionPool | null = null
  private connecting = false
  private constructor() {}
  static getInstance() {
    if (!MigratedDb.instance) MigratedDb.instance = new MigratedDb()
    return MigratedDb.instance
  }
  async getPool(): Promise<ConnectionPool> {
    if (this.pool && this.pool.connected) return this.pool
    if (this.connecting) {
      while (this.connecting) await new Promise(r => setTimeout(r, 50))
      if (this.pool && this.pool.connected) return this.pool
    }
    this.connecting = true
    try {
      this.pool = await sql.connect(config)
      return this.pool
    } finally {
      this.connecting = false
    }
  }
}

export async function getMigratedPool() {
  return MigratedDb.getInstance().getPool()
}

// Coerce a raw extracted string cell into a JS value matching the sqlsType, for mssql bulk.
// Transcribed from FB_Migration/src/etl/type-map.js coerceCell (faithful).
export function coerceCell(raw: string | null | undefined, sqlsType: string): unknown {
  if (raw === null || raw === undefined) return null
  const t = sqlsType.toUpperCase()
  if (t.startsWith('SMALLINT') || t.startsWith('INT') || t.startsWith('BIGINT')) {
    const n = parseInt(raw, 10)
    return Number.isNaN(n) ? null : n
  }
  if (t.startsWith('REAL') || t.startsWith('FLOAT')) {
    const n = parseFloat(raw)
    return Number.isNaN(n) ? null : n
  }
  if (t.startsWith('DATE') || t.startsWith('DATETIME2') || t.startsWith('TIME')) {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d // zero/placeholder dates -> null (logged upstream)
  }
  if (t.startsWith('VARBINARY')) {
    return Buffer.from(raw, 'binary')
  }
  return raw
}

// Map sqls type string -> mssql type constructor. Transcribed from client.js toMssqlType.
export function toMssqlType(sqlsType: string) {
  const t = sqlsType.toUpperCase()
  const m = t.match(/^([A-Z]+)(?:\((\d+|MAX)\))?$/)
  const base = m ? m[1] : t
  const len = m && m[2] ? (m[2] === 'MAX' ? sql.MAX : parseInt(m[2], 10)) : undefined
  switch (base) {
    case 'INT': return sql.Int
    case 'SMALLINT': return sql.SmallInt
    case 'BIGINT': return sql.BigInt
    case 'REAL': return sql.Real
    case 'FLOAT': return sql.Float
    case 'DATE': return sql.Date
    case 'TIME': return sql.Time
    case 'DATETIME2': return sql.DateTime2
    case 'NVARCHAR': return len ? sql.NVarChar(len) : sql.NVarChar(sql.MAX)
    case 'NCHAR': return len ? sql.NChar(len) : sql.NChar(1)
    case 'VARBINARY': return len ? sql.VarBinary(len) : sql.VarBinary(sql.MAX)
    default: return sql.NVarChar(sql.MAX)
  }
}

// Firebird field type code -> SQL Server type. Transcribed from FB_Migration type-map.js toSqlsCol.
export function toSqlsCol(fbCol: { type: number; length: number; subtype: number; nullable: boolean; name: string }) {
  const { type, subtype, nullable, name } = fbCol
  let sqlsType: string
  switch (type) {
    case 7: sqlsType = 'SMALLINT'; break
    case 8: sqlsType = 'INT'; break
    case 10: sqlsType = 'REAL'; break
    case 27: sqlsType = 'FLOAT'; break
    case 12: sqlsType = 'DATE'; break
    case 13: sqlsType = 'TIME'; break
    case 35: sqlsType = 'DATETIME2'; break
    case 14: sqlsType = 'NVARCHAR(MAX)'; break // char — MAX (source lengths unreliable for multibyte)
    case 37: sqlsType = 'NVARCHAR(MAX)'; break // varchar
    case 261: sqlsType = subtype === 1 ? 'NVARCHAR(MAX)' : 'VARBINARY(MAX)'; break // blob
    default: sqlsType = 'NVARCHAR(MAX)' // safe fallback
  }
  return { name, sqlsType, nullable }
}
