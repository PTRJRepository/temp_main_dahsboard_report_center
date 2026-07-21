/**
 * SQL Gateway base URL resolution for Report Center.
 * Default host: 10.0.0.110 — fallback: localhost.
 * User override only accepted when allowlisted (header / query).
 */

export const SQL_GATEWAY_PRIMARY = 'http://10.0.0.110:8001'
export const SQL_GATEWAY_FALLBACK = 'http://localhost:8001'
export const SQL_GATEWAY_OVERRIDE_HEADER = 'x-sql-gateway-base'
export const SQL_GATEWAY_CLIENT_STORAGE_KEY = 'report-center:sql-gateway-base'

/** Presets shown in Report Center connection UI */
export const SQL_GATEWAY_PRESETS = [
  { id: 'primary', label: 'Server 10.0.0.110', baseUrl: SQL_GATEWAY_PRIMARY },
  { id: 'fallback', label: 'Localhost', baseUrl: SQL_GATEWAY_FALLBACK },
  { id: 'primary-query', label: 'Gateway 10.0.0.110:3001/query', baseUrl: 'http://10.0.0.110:3001/query' },
  { id: 'local-query', label: 'Gateway localhost:3001/query', baseUrl: 'http://localhost:3001/query' },
] as const

const ALLOWED_BASES = new Set(
  [
    SQL_GATEWAY_PRIMARY,
    SQL_GATEWAY_FALLBACK,
    'http://127.0.0.1:8001',
    'http://10.0.0.110:3001/query',
    'http://localhost:3001/query',
    'http://127.0.0.1:3001/query',
  ].map((u) => normalizeSqlGatewayBase(u)),
)

export function normalizeSqlGatewayBase(value: unknown): string {
  if (typeof value !== 'string') return ''
  let raw = value.trim()
  if (!raw) return ''
  // Accept full query path; strip to gateway root
  raw = raw.replace(/\/v1\/query\/?$/i, '')
  raw = raw.replace(/\/+$/, '')
  return raw
}

export function isAllowedSqlGatewayBase(value: unknown): boolean {
  const n = normalizeSqlGatewayBase(value)
  return Boolean(n) && ALLOWED_BASES.has(n)
}

export type ResolveSqlGatewayOptions = {
  env?: Partial<Record<string, string | undefined>>
  /** Client-supplied override (header/query); must be allowlisted */
  override?: string | null
}

/**
 * Resolve gateway base:
 * 1) allowlisted override
 * 2) SQL_GATEWAY_URL env
 * 3) primary 10.0.0.110:8001
 * (localhost is selectable fallback, not auto-picked unless env/override says so)
 */
export function resolveSqlGatewayBase(options: ResolveSqlGatewayOptions = {}): string {
  const env = options.env ?? process.env
  const override = normalizeSqlGatewayBase(options.override)
  if (override && isAllowedSqlGatewayBase(override)) return override

  const fromEnv = normalizeSqlGatewayBase(env.SQL_GATEWAY_URL)
  if (fromEnv) return fromEnv

  return SQL_GATEWAY_PRIMARY
}

export function resolveSqlGatewayApiKey(env: Partial<Record<string, string | undefined>> = process.env): string {
  const key = typeof env.SQL_GATEWAY_API_KEY === 'string' ? env.SQL_GATEWAY_API_KEY.trim() : ''
  return key
}

/** Build absolute /v1/query URL from a gateway base */
export function sqlGatewayQueryUrl(base: string): string {
  const n = normalizeSqlGatewayBase(base)
  return `${n}/v1/query`
}

export function sqlGatewayServersUrl(base: string): string {
  const n = normalizeSqlGatewayBase(base)
  return `${n}/v1/servers`
}

/**
 * Read allowlisted override from request headers or ?gatewayBase=
 */
export function gatewayOverrideFromRequest(input: {
  headers?: { get(name: string): string | null }
  searchParams?: { get(name: string): string | null }
}): string | null {
  const fromHeader = input.headers?.get(SQL_GATEWAY_OVERRIDE_HEADER)
  const fromQuery = input.searchParams?.get('gatewayBase')
  const raw = fromHeader || fromQuery || null
  if (!raw) return null
  return isAllowedSqlGatewayBase(raw) ? normalizeSqlGatewayBase(raw) : null
}
