import { NextRequest, NextResponse } from 'next/server'
import {
  adaptMonthlyStockMovementNestedResponse,
  createMonthlyStockAccountMovementPayload,
} from '@/modules/report-center/lib/reports/inventory/monthly-stock-account-movement'
import {
  getInventoryQueryContext,
  normalizeInventoryQueryLimit,
  type InventoryReportSource,
} from '@/modules/report-center/lib/reports/inventory/query-gateway'
import { filtersFromSearchParams } from '@/modules/report-center/lib/reports/report-filtering'

export const dynamic = 'force-dynamic'

function getSource(request: NextRequest): InventoryReportSource {
  const raw = (request.nextUrl.searchParams.get('source') ?? '').trim().toLowerCase()
  return raw === 'estate' || raw === 'kebun' ? 'estate' : 'pabrik'
}

export async function GET(request: NextRequest) {
  try {
    const filters = filtersFromSearchParams(request.nextUrl.searchParams)
    const limit = normalizeInventoryQueryLimit(request.nextUrl.searchParams.get('limit'), {
      min: 1,
      max: 20_000,
      fallback: 500,
    })
    const ctx = getInventoryQueryContext(getSource(request))
    const payload = await createMonthlyStockAccountMovementPayload({
      ctx,
      filters,
      search: filters.search,
      limit,
    })

    return NextResponse.json(adaptMonthlyStockMovementNestedResponse(payload))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query monthly stock movement gagal diproses.' },
      { status: 500 },
    )
  }
}
