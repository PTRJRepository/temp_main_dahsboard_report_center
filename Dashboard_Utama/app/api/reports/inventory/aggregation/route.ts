import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { currentActualPeriodJakarta } from '@/modules/report-center/lib/reports/accounting-period'
import { listAggregates, deleteAggregate } from '@/modules/report-center/lib/reports/inventory/monthly-aggregate-store'
import { resolveAggregationPeriod } from '@/modules/report-center/lib/reports/inventory/monthly-aggregate'

/**
 * Control room API untuk agregasi KPI bulanan pre-rendered.
 *
 * - GET    → status periode closed × report KPI + flag built (dari store) + daftar built.
 * - POST   → trigger build/rebuild untuk (handlerKey, period) CLOSED via loopback ke
 *            `/api/reports/inventory` (route itu sendiri yang hitung + persist).
 * - DELETE → invalidate agregasi (by id, atau handlerKey+period).
 *
 * Periode current selalu ditolak untuk build (data berubah terus → live).
 */

// Report KPI yang dipakai command deck — subset yang paling berat & sering dibuka.
const DECK_HANDLER_KEYS = [
  'asset-stock-valuasi-listing',
  'goods-receiving-receipt-activity',
  'purchase-order-history',
  'purchase-request-inventory',
  'all-stock-movement-analysis',
  'pengeluaran-barang',
  'return-barang',
] as const

function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

/** Daftar N actual period 'YYYY-MM' closed terakhir (bulan berjalan tidak disertakan). */
function closedPeriodsBack(count: number, now: Date = new Date()): string[] {
  const current = currentActualPeriodJakarta(now)
  const periods: string[] = []
  let year = current.year
  let month = current.month - 1
  for (let i = 0; i < count; i += 1) {
    if (month === 0) {
      month = 12
      year -= 1
    }
    periods.push(`${year}-${padMonth(month)}`)
    month -= 1
  }
  return periods
}

function getParam(request: NextRequest, key: string) {
  return (request.nextUrl.searchParams.get(key) ?? '').trim()
}

export async function GET(request: NextRequest) {
  const now = new Date()
  const current = currentActualPeriodJakarta(now)
  const monthsParam = Number(getParam(request, 'months'))
  const months = Number.isFinite(monthsParam) && monthsParam >= 1 && monthsParam <= 60 ? Math.trunc(monthsParam) : 18
  const periods = closedPeriodsBack(months, now)

  const stored = await listAggregates().catch(() => [])
  const builtSet = new Set(stored.map((row) => `${row.handlerKey}@@${row.period}`))

  const cells = DECK_HANDLER_KEYS.map((handlerKey) => ({
    handlerKey,
    periods: periods.map((period) => ({
      period,
      built: builtSet.has(`${handlerKey}@@${period}`),
    })),
  }))

  return NextResponse.json({
    success: true,
    currentPeriod: current.period,
    closedPeriods: periods,
    handlerKeys: [...DECK_HANDLER_KEYS],
    cells,
    built: stored,
  })
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    handlerKeys?: string[]
    periods?: string[]
    source?: string
  }
  const source = body.source === 'pabrik' ? 'pabrik' : 'estate'
  const handlerKeys = (Array.isArray(body.handlerKeys) && body.handlerKeys.length > 0
    ? body.handlerKeys
    : [...DECK_HANDLER_KEYS]
  ).filter((key): key is string => typeof key === 'string')
  const requestedPeriods = Array.isArray(body.periods) && body.periods.length > 0
    ? body.periods.filter((period): period is string => typeof period === 'string')
    : closedPeriodsBack(6)

  // Hanya periode CLOSED yang boleh dibangun. Current/invalid ditolak & dilaporkan.
  const accepted: string[] = []
  const rejected: Array<{ period: string; reason: string }> = []
  for (const period of requestedPeriods) {
    const resolution = resolveAggregationPeriod({ period })
    if (resolution.closed && resolution.period) accepted.push(resolution.period)
    else rejected.push({ period, reason: resolution.period ? 'periode current/masa depan = live' : 'format period tidak valid' })
  }

  const origin = request.nextUrl.origin
  const gatewayBase = request.headers.get('x-sql-gateway-base') ?? ''
  const results: Array<{ handlerKey: string; period: string; ok: boolean; mode?: string }> = []

  for (const handlerKey of handlerKeys) {
    for (const period of accepted) {
      const params = new URLSearchParams({
        report: handlerKey,
        source,
        page: '1',
        pageSize: '5',
        limit: '5',
        period,
      })
      try {
        const response = await fetch(`${origin}/api/reports/inventory?${params.toString()}`, {
          cache: 'no-store',
          headers: gatewayBase ? { 'x-sql-gateway-base': gatewayBase } : undefined,
        })
        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean
          data?: {
            metadata?: {
              aggregation?: { mode?: string }
            }
          }
        }
        const mode = data?.data?.metadata?.aggregation?.mode
        // ok bila request sukses DAN route benar-benar menyajikan dari/untuk agregasi.
        results.push({ handlerKey, period, ok: response.ok && data.success === true, mode })
      } catch {
        results.push({ handlerKey, period, ok: false })
      }
    }
  }

  return NextResponse.json({
    success: true,
    source,
    accepted,
    rejected,
    built: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    results,
  })
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; handlerKey?: string; period?: string }
  const removed = await deleteAggregate({ id: body.id, handlerKey: body.handlerKey, period: body.period }).catch(() => 0)
  return NextResponse.json({ success: true, removed })
}
