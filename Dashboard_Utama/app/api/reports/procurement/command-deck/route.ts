import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Composite Procurement Command Deck endpoint.
 *
 * Menggantikan 8 fetch paralel browser -> satu round-trip server yang menjalankan
 * 8 report inventory secara server-side (paralel) dan menggabungkan `summary` +
 * `chart` tiap report. Kontrak filter identik dengan `procurementFilterParams`
 * di `components/report-center/ProcurementKpiStrip.tsx`.
 *
 * Strategi: internal loopback fetch ke `/api/reports/inventory` (reuse penuh
 * mesin query + auth/gateway handling yang sudah ada), bukan duplikasi SQL.
 */

type DbRow = Record<string, unknown>

type Snapshot = {
  ok: boolean
  summary: DbRow
  chart?: DbRow[]
  topLists?: {
    items?: DbRow[]
    costCenters?: DbRow[]
    vehicles?: DbRow[]
    blocks?: DbRow[]
  }
  trend?: DbRow[]
  issueFrequency?: {
    byMonth?: DbRow[]
    topItems?: DbRow[]
  }
  updatedAt?: string
}

type KpiKey = 'stock' | 'receive' | 'po' | 'pr' | 'workshop' | 'movement' | 'movementMonthly' | 'usage' | 'fuel' | 'return'

type KpiSpec = {
  key: KpiKey
  report: string
}

const KPI_SPECS: KpiSpec[] = [
  { key: 'stock', report: 'asset-stock-valuasi-listing' },
  { key: 'receive', report: 'goods-receiving-receipt-activity' },
  { key: 'po', report: 'purchase-order-history' },
  { key: 'pr', report: 'purchase-request-inventory' },
  { key: 'workshop', report: 'asset-stock-valuasi-listing' },
  { key: 'movement', report: 'all-stock-movement-analysis' },
  { key: 'movementMonthly', report: 'monthly-stock-account-movement-details' },
  { key: 'usage', report: 'pengeluaran-barang' },
  { key: 'fuel', report: 'fuel-usage' },
  { key: 'return', report: 'return-barang' },
]

type CommandDeckFilters = {
  period: string
  movementWindow: string
  groupBy: string
  scopeCode: string
  itemType: '' | 'gudang' | 'workshop'
  location: string
  /** Rentang tanggal custom (mode tahun) — override period bila diisi. */
  dateFrom: string
  dateTo: string
}

function getParam(request: NextRequest, key: string) {
  return (request.nextUrl.searchParams.get(key) ?? '').trim()
}

function readFilters(request: NextRequest): CommandDeckFilters {
  const rawItemType = getParam(request, 'itemType')
  return {
    period: getParam(request, 'period'),
    movementWindow: getParam(request, 'movementWindow') || 'all',
    groupBy: getParam(request, 'groupBy') || 'ProductTypeCode',
    scopeCode: getParam(request, 'scopeCode'),
    itemType: rawItemType === 'gudang' || rawItemType === 'workshop' ? rawItemType : '',
    location: getParam(request, 'location'),
    dateFrom: getParam(request, 'dateFrom'),
    dateTo: getParam(request, 'dateTo'),
  }
}

/** Mirror `analysisScopeParams` di ProcurementKpiStrip — map groupBy+scopeCode ke param API. */
function analysisScopeParams(filters: CommandDeckFilters): Record<string, string> {
  const value = filters.scopeCode
  const params: Record<string, string> = {}
  if (!value) return params
  switch (filters.groupBy) {
    case 'StockAnalysisCode':
      params.stockAnalysis = value
      params.category = value
      break
    case 'ProductTypeCode':
      params.productType = value
      break
    case 'ProductCategoryCode':
      params.productCategory = value
      params.category = value
      break
    case 'ProductBrandCode':
      params.productBrand = value
      break
    case 'ProductModelCode':
      params.productModel = value
      break
    case 'ProductMaterialCode':
      params.productMaterial = value
      break
  }
  return params
}

/** Mirror `procurementFilterParams` — param bersama untuk semua report. */
function baseFilterParams(filters: CommandDeckFilters): Record<string, string> {
  const params: Record<string, string> = {
    period: filters.period,
    ...analysisScopeParams(filters),
  }
  if (filters.location) params.location = filters.location
  if (filters.itemType) params.itemType = filters.itemType
  return params
}

/**
 * Param usage (pengeluaran-barang) — mendukung rentang tanggal custom (mode tahun).
 * dateFrom/dateTo meng-override period untuk handler yang membacanya (stockIssue).
 */
function usageParams(filters: CommandDeckFilters): Record<string, string> {
  const base = baseFilterParams(filters)
  if (filters.dateFrom) {
    base.dateFrom = filters.dateFrom
    base.dateTo = filters.dateTo || filters.dateFrom
    delete base.period
  }
  return base
}

/** Param khusus per KPI key (GUARDRAIL stock/movement, workshop override, movement dims). */
function specExtraParams(spec: KpiSpec, filters: CommandDeckFilters): Record<string, string> {
  const base = baseFilterParams(filters)
  if (spec.key === 'workshop') {
    return { ...base, itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop' }
  }
  if (spec.key === 'movement') {
    // KPI deck: lock movement timeline ke periode terpilih (bukan MC 'all'),
    // supaya Issue Amount/Qty selaras dengan Total Usage period.
    if (filters.dateFrom) {
      return {
        ...base,
        ...analysisScopeParams(filters),
        groupBy: 'MovementCategory',
        chartDimension: 'MovementCategory',
        movementWindow: 'custom',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo || filters.dateFrom,
      }
    }
    return {
      ...base,
      ...analysisScopeParams(filters),
      groupBy: 'MovementCategory',
      chartDimension: 'MovementCategory',
      movementWindow: '1m',
      period: filters.period,
    }
  }
  // Process flow + usage/fuel all follow selected period (or custom year range).
  if (
    spec.key === 'usage'
    || spec.key === 'fuel'
    || spec.key === 'receive'
    || spec.key === 'return'
    || spec.key === 'po'
    || spec.key === 'pr'
    || spec.key === 'movementMonthly'
  ) {
    return usageParams(filters)
  }
  return base
}

function firstText(summary: DbRow | undefined, keys: string[]) {
  if (!summary) return ''
  const key = keys.find((item) => summary[item] !== undefined && summary[item] !== null && summary[item] !== '')
  return key ? String(summary[key]) : ''
}

async function fetchSnapshot(
  origin: string,
  gatewayBase: string,
  source: string,
  spec: KpiSpec,
  filters: CommandDeckFilters,
): Promise<readonly [KpiKey, Snapshot]> {
  const params = new URLSearchParams({
    report: spec.report,
    source,
    page: '1',
    pageSize: '5',
    limit: '5',
    ...specExtraParams(spec, filters),
  })
  try {
    const response = await fetch(`${origin}/api/reports/inventory?${params.toString()}`, {
      cache: 'no-store',
      headers: gatewayBase ? { 'x-sql-gateway-base': gatewayBase } : undefined,
    })
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean
      data?: {
        summary?: DbRow
        chart?: DbRow[]
        topLists?: Snapshot['topLists']
        trend?: DbRow[]
        issueFrequency?: Snapshot['issueFrequency']
      }
    }
    if (!response.ok || data.success !== true || !data.data?.summary) {
      return [spec.key, { ok: false, summary: {} }] as const
    }
    const summary = data.data.summary
    return [spec.key, {
      ok: true,
      summary,
      chart: data.data.chart ?? [],
      topLists: data.data.topLists,
      trend: data.data.trend,
      issueFrequency: data.data.issueFrequency,
      updatedAt: firstText(summary, ['TerakhirUpdate', 'LastMovementDate', 'LastUsageDate', 'LastRunningUpdate']),
    }] as const
  } catch {
    return [spec.key, { ok: false, summary: {} }] as const
  }
}

// In-memory TTL cache singkat untuk meredam beban 8 query SQL Server per refresh.
// Key = serialized filter+source+gateway. Tidak mengubah kontrak response.
const CACHE_TTL_MS = 30_000
const cache = new Map<string, { expiresAt: number; payload: CommandDeckResponse }>()

type CommandDeckResponse = {
  success: boolean
  source: string
  generatedAt: string
  snapshots: Partial<Record<KpiKey, Snapshot>>
}

function cacheKey(source: string, gatewayBase: string, filters: CommandDeckFilters) {
  return JSON.stringify([source, gatewayBase, filters])
}

function readCache(key: string): CommandDeckResponse | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.payload
}

function writeCache(key: string, payload: CommandDeckResponse) {
  // Batasi ukuran cache agar tidak tumbuh tak terkendali.
  if (cache.size > 200) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
}

export async function GET(request: NextRequest) {
  const source = getParam(request, 'source') === 'pabrik' ? 'pabrik' : 'estate'
  const gatewayBase = request.headers.get('x-sql-gateway-base') ?? ''
  const filters = readFilters(request)
  const key = cacheKey(source, gatewayBase, filters)

  const cached = readCache(key)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // Origin loopback dari request masuk — jangan hardcode host/port.
  const origin = request.nextUrl.origin

  const results = await Promise.allSettled(
    KPI_SPECS.map((spec) => fetchSnapshot(origin, gatewayBase, source, spec, filters)),
  )

  const snapshots: Partial<Record<KpiKey, Snapshot>> = {}
  results.forEach((result, index) => {
    const specKey = KPI_SPECS[index].key
    snapshots[specKey] = result.status === 'fulfilled'
      ? result.value[1]
      : { ok: false, summary: {} }
  })

  const payload: CommandDeckResponse = {
    success: true,
    source,
    generatedAt: new Date().toISOString(),
    snapshots,
  }
  writeCache(key, payload)

  return NextResponse.json(payload)
}
