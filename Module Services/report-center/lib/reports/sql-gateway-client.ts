'use client'

import {
  SQL_GATEWAY_CLIENT_STORAGE_KEY,
  SQL_GATEWAY_OVERRIDE_HEADER,
  SQL_GATEWAY_PRIMARY,
  isAllowedSqlGatewayBase,
  normalizeSqlGatewayBase,
} from './sql-gateway-config'

export function readClientSqlGatewayBase(): string {
  if (typeof window === 'undefined') return SQL_GATEWAY_PRIMARY
  try {
    const raw = window.localStorage.getItem(SQL_GATEWAY_CLIENT_STORAGE_KEY)
    const n = normalizeSqlGatewayBase(raw)
    if (n && isAllowedSqlGatewayBase(n)) return n
  } catch {
    /* ignore */
  }
  return SQL_GATEWAY_PRIMARY
}

export function writeClientSqlGatewayBase(base: string): string {
  const n = normalizeSqlGatewayBase(base)
  const next = n && isAllowedSqlGatewayBase(n) ? n : SQL_GATEWAY_PRIMARY
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SQL_GATEWAY_CLIENT_STORAGE_KEY, next)
    window.dispatchEvent(new CustomEvent('report-center-gateway-change', { detail: next }))
  }
  return next
}

/** Headers for report API calls so server uses the same gateway as UI. */
export function sqlGatewayRequestHeaders(extra?: HeadersInit): HeadersInit {
  const base = readClientSqlGatewayBase()
  return {
    ...(extra ?? {}),
    [SQL_GATEWAY_OVERRIDE_HEADER]: base,
  }
}

export function withGatewayBaseParam(params: URLSearchParams, base = readClientSqlGatewayBase()) {
  if (base && isAllowedSqlGatewayBase(base)) params.set('gatewayBase', base)
  return params
}
