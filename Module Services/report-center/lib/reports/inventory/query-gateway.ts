import { validateReadOnlySql } from '../report-filtering'
import { resolveSqlGatewayApiKey, resolveSqlGatewayCandidates, sqlGatewayQueryUrl } from '../sql-gateway-config'

export type InventoryReportSource = 'estate' | 'pabrik'

export type InventoryQueryContext = {
  source: InventoryReportSource
  sourceLabel: string
  server: string
  database: string
  dataSource: string
  publicSourceId: string
}

export type InventoryGatewayResult = {
  success: boolean
  db?: string | null
  execution_ms?: number
  data?: {
    recordset?: Record<string, unknown>[]
    rowsAffected?: number[]
  } | null
  error?: string | null
}

export type InventoryQueryGatewayOptions = {
  env?: Partial<Record<string, string | undefined>>
  /** Allowlisted client override (header / localStorage) */
  gatewayOverride?: string | null
  fetchFn?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_QUERY_TIMEOUT_MS = 45_000
const MIN_QUERY_TIMEOUT_MS = 5_000
const MAX_QUERY_TIMEOUT_MS = 120_000

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeInventoryQueryLimit(value: unknown, options: { min?: number; max?: number; fallback?: number } = {}) {
  const min = options.min ?? 1
  const max = options.max ?? 20_000
  const fallback = options.fallback ?? min
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(Math.trunc(numeric), min), max)
}

export function normalizeInventoryQueryTimeoutMs(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_QUERY_TIMEOUT_MS
  return Math.min(Math.max(Math.trunc(numeric), MIN_QUERY_TIMEOUT_MS), MAX_QUERY_TIMEOUT_MS)
}

export function databaseForInventorySource(source: InventoryReportSource, env: Partial<Record<string, string | undefined>> = process.env) {
  if (cleanText(env.DATABASE_NAME)) return cleanText(env.DATABASE_NAME)
  return source === 'pabrik' ? 'db_ptrj_mill' : 'db_ptrj'
}

export function getInventoryQueryContext(source: InventoryReportSource, env: Partial<Record<string, string | undefined>> = process.env): InventoryQueryContext {
  const server = source === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'
  return {
    source,
    sourceLabel: source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun',
    server,
    database: databaseForInventorySource(source, env),
    dataSource: source === 'pabrik' ? 'Pabrik Inventory DB (Live)' : 'Estate Inventory DB (Live)',
    publicSourceId: source === 'pabrik' ? 'pabrik-inventory-live' : 'estate-inventory-live',
  }
}

export function sanitizeInventoryQueryError(error: unknown) {
  if (typeof error === 'string' && error.trim()) return 'Query inventory gagal diproses oleh gateway.'
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Query inventory melewati batas waktu aman.'
  if (error instanceof DOMException && error.name === 'AbortError') return 'Query inventory dibatalkan.'
  return 'Query inventory gagal diproses.'
}

export async function executeInventoryReadQuery(
  ctx: InventoryQueryContext,
  sql: string,
  options: InventoryQueryGatewayOptions = {},
): Promise<InventoryGatewayResult> {
  const validation = validateReadOnlySql(sql)
  if (!validation.safe) {
    return {
      success: false,
      error: validation.reason ?? 'Query non-read diblokir oleh validator report.',
    }
  }

  const env = options.env ?? process.env
  const gatewayBases = resolveSqlGatewayCandidates({ env, override: options.gatewayOverride })
  const apiKey = resolveSqlGatewayApiKey(env) || cleanText(env.SQL_GATEWAY_API_KEY)
  if (!apiKey) {
    return {
      success: false,
      error: 'Konfigurasi query inventory belum lengkap.',
    }
  }

  if (options.signal?.aborted) {
    return {
      success: false,
      error: 'Query inventory dibatalkan.',
    }
  }

  const timeoutMs = normalizeInventoryQueryTimeoutMs(options.timeoutMs ?? env.SQL_GATEWAY_TIMEOUT_MS)
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('Inventory query timeout', 'TimeoutError'))
  }, timeoutMs)
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', abort, { once: true })

  let lastError: string | null = null
  try {
    for (const gatewayUrl of gatewayBases) {
      try {
        const response = await (options.fetchFn ?? fetch)(sqlGatewayQueryUrl(gatewayUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ sql, server: ctx.server, database: ctx.database }),
          cache: 'no-store',
          signal: controller.signal,
        })

        const result = (await response.json().catch(() => ({}))) as InventoryGatewayResult
        if (!response.ok || result.success === false) {
          lastError = response.status === 408 || response.status === 504
            ? 'Query inventory melewati batas waktu aman.'
            : 'Query inventory gagal diproses oleh gateway.'
          // Non-OK on the first candidate: try the next base.
          if (gatewayBases.length > 1) continue
          return {
            success: false,
            error: lastError,
            execution_ms: result.execution_ms,
          }
        }

        return {
          success: true,
          data: result.data,
          execution_ms: result.execution_ms,
        }
      } catch (error) {
        lastError = timedOut ? 'Query inventory melewati batas waktu aman.' : sanitizeInventoryQueryError(error)
        // Connection failure — try the fallback gateway base.
        if (gatewayBases.length > 1) continue
      }
    }
    return {
      success: false,
      error: lastError ?? 'Query inventory gagal diproses.',
    }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
