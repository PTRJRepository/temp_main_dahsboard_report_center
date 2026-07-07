/**
 * lib/hooks/useReports.ts
 * Thin, focused hook for fetching Report[] from the SQL Gateway API.
 * Falls back to mock data when the backend is unavailable.
 *
 * SQL Gateway: POST http://10.0.0.110:3001/query/v1/query
 * Headers  : x-api-key: [REDACTED], Content-Type: application/json
 * DB       : db_ptrj_mill (READ-ONLY)
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { getMockReportsByModule, type Report } from '@/lib/mock-data'

// ─── Exported types ────────────────────────────────────────────────────────────

export type { Report }

export interface UseReportsOptions {
  /** Filter by module slug (e.g. 'inventory', 'payroll'). Omit for all modules. */
  moduleId?: string
  /** Override the staleTime (default: 5 min) */
  staleTime?: number
  /** Disable the query (default: true) */
  enabled?: boolean
}

// ─── SQL Gateway fetch ─────────────────────────────────────────────────────────

async function fetchReportsFromApi(moduleId?: string): Promise<Report[]> {
  const body = moduleId
    ? { query: 'SELECT TOP 50 * FROM reports WHERE module_id = @moduleId ORDER BY last_run DESC', params: [{ name: 'moduleId', value: moduleId }] }
    : { query: 'SELECT TOP 50 * FROM reports ORDER BY last_run DESC', params: [] }

  const res = await fetch('http://10.0.0.110:3001/query/v1/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '[REDACTED]',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`SQL Gateway error: ${res.status}`)

  // Normalise snake_case API response → camelCase Report fields
  const rows: Record<string, unknown>[] = await res.json()
  return rows.map((r) => ({
    id:        String(r.id ?? ''),
    moduleId:  String(r.module_id ?? ''),
    name:      String(r.name ?? ''),
    category:  String(r.category ?? ''),
    description: String(r.description ?? ''),
    lastRun:   String(r.last_run ?? ''),
    status:   (r.status as Report['status']) ?? 'completed',
    rowCount: Number(r.row_count ?? 0),
  }))
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useReports({ moduleId, staleTime = 5 * 60 * 1000, enabled = true }: UseReportsOptions = {}) {
  return useQuery<Report[]>({
    queryKey: ['reports', moduleId],
    enabled,

    queryFn: async () => {
      try {
        return await fetchReportsFromApi(moduleId)
      } catch {
        // API unavailable or timed out — serve mock data instead
        return getMockReportsByModule(moduleId)
      }
    },

    staleTime,
  })
}

// ─── Backward-compatible query key factory (used by useExport.ts) ─────────────

export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (moduleId?: string) => [...reportKeys.lists(), moduleId] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
} as const

// ─── Convenience exports ────────────────────────────────────────────────────────

/** Returns a single report by id. */
export function useReport(id: string) {
  return useQuery<Report | undefined>({
    queryKey: ['report', id],
    queryFn: async () => {
      try {
        const res = await fetch('http://10.0.0.110:3001/query/v1/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': '[REDACTED]' },
          body: JSON.stringify({
            query: 'SELECT * FROM reports WHERE id = @id',
            params: [{ name: 'id', value: id }],
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) throw new Error('not found')
        const rows: Record<string, unknown>[] = await res.json()
        if (!rows.length) return undefined
        const r = rows[0]
        return {
          id:        String(r.id ?? ''),
          moduleId:  String(r.module_id ?? ''),
          name:      String(r.name ?? ''),
          category:  String(r.category ?? ''),
          description: String(r.description ?? ''),
          lastRun:   String(r.last_run ?? ''),
          status:   (r.status as Report['status']) ?? 'completed',
          rowCount: Number(r.row_count ?? 0),
        }
      } catch {
        return getMockReportsByModule().find((rep) => rep.id === id)
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}