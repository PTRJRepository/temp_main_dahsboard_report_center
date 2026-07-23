'use client'

import Link from 'next/link'
import { startTransition, useEffect, useState } from 'react'
import { ArrowRight, CircleDollarSign, ClipboardList, Gauge, Layers3, Package, TrendingDown, TrendingUp, Truck, Wrench } from 'lucide-react'
import { frequencyPerDay, poFillRate, returnRate, usageIntensity as calcUsageIntensity } from '@/lib/reports/procurement-kpi-math'
import KpiCarousel from './KpiCarousel'
import MovementTrendChart from './MovementTrendChart'
import TopMovementScatter from './TopMovementScatter'
import StockRiverChart from './StockRiverChart'
import InsightTicker from './InsightTicker'
import ProcurementFlowStrip, { type FlowStage } from './ProcurementFlowStrip'
import type { ReportSource } from '@/lib/reports/procurement-workspace'

type DeckSection = 'valuasi' | 'proses' | 'movement'

type DbRow = Record<string, unknown>

type KpiKey = 'stock' | 'receive' | 'po' | 'pr' | 'workshop' | 'movement' | 'movementMonthly' | 'usage' | 'return'

type TopListItem = {
  code?: string
  name?: string
  events?: number
  qty?: number
  amount?: number
}

type TrendPoint = {
  month?: string
  events?: number
  qty?: number
  amount?: number
}

type Snapshot = {
  ok: boolean
  summary: DbRow
  chart?: DbRow[]
  topLists?: {
    items?: TopListItem[]
    costCenters?: TopListItem[]
    vehicles?: TopListItem[]
  }
  trend?: TrendPoint[]
  issueFrequency?: {
    byMonth?: Array<{ month?: string; docs?: number | string; activeDays?: number | string; qty?: number | string }>
    topItems?: Array<{ code?: string; name?: string; docs?: number | string; events?: number | string; qty?: number | string }>
  }
  updatedAt?: string
}

type KpiState = {
  source: ReportSource
  loading: boolean
  snapshots: Partial<Record<KpiKey, Snapshot>>
}

type ProcurementAnalysisGroup =
  | 'StockAnalysisCode'
  | 'ProductTypeCode'
  | 'ProductCategoryCode'
  | 'ProductBrandCode'
  | 'ProductModelCode'
  | 'ProductMaterialCode'

export type ProcurementKpiFilters = {
  period: string
  movementWindow: string
  groupBy: ProcurementAnalysisGroup
  scopeCode: string
  itemType: '' | 'gudang' | 'workshop'
  location: string
  /** Mode periode: bulan tunggal (default) atau satu tahun penuh (custom). */
  periodMode?: 'month' | 'year'
  /** Tahun custom (YYYY) saat periodMode === 'year'. */
  customYear?: string
}

type ProcurementKpiStripProps = {
  source: ReportSource
  links: Record<'stock' | 'receive' | 'process' | 'workshop' | 'movement' | 'usage' | 'return', string>
  /** Parent-owned filters → one scope for all KPI + sibling overview. */
  filters?: ProcurementKpiFilters
  onFiltersChange?: (next: ProcurementKpiFilters) => void
}

type ProcurementKpiBreakdown = {
  label: string
  value: string
}

type ProcurementKpiCard = {
  id: string
  label: string
  value: string
  /** Full-precision value for title/aria when value is compact. */
  valueExact?: string
  description: string
  formula: string
  source: string
  breakdown: ProcurementKpiBreakdown[]
  href: string
  icon: typeof Package
  className: string
}

const DECK_SECTIONS: Array<{ id: DeckSection; label: string; tone: string }> = [
  { id: 'valuasi', label: 'Valuasi', tone: 'text-emerald-100/80 border-emerald-300/30 data-[active=true]:bg-emerald-400/15 data-[active=true]:text-emerald-50' },
  { id: 'proses', label: 'Proses', tone: 'text-sky-100/80 border-sky-300/30 data-[active=true]:bg-sky-400/15 data-[active=true]:text-sky-50' },
  { id: 'movement', label: 'Movement', tone: 'text-rose-100/80 border-rose-300/30 data-[active=true]:bg-rose-400/15 data-[active=true]:text-rose-50' },
]

const kpiRequests: Array<{ key: KpiKey; report: string }> = [
  { key: 'stock', report: 'asset-stock-valuasi-listing' },
  { key: 'receive', report: 'goods-receiving-receipt-activity' },
  { key: 'po', report: 'purchase-order-history' },
  { key: 'pr', report: 'purchase-request-inventory' },
  { key: 'workshop', report: 'asset-stock-valuasi-listing' },
  { key: 'movement', report: 'all-stock-movement-analysis' },
  { key: 'usage', report: 'pengeluaran-barang' },
  { key: 'return', report: 'return-barang' },
]

const analysisGroupOptions: Array<{ value: ProcurementAnalysisGroup; label: string; placeholder: string }> = [
  { value: 'StockAnalysisCode', label: 'Stock Analysis', placeholder: 'DEADS / MEMOV / SLMOV' },
  { value: 'ProductTypeCode', label: 'Product Type', placeholder: 'Contoh: SP / FUEL' },
  { value: 'ProductCategoryCode', label: 'Product Category', placeholder: 'Kode kategori produk' },
  { value: 'ProductBrandCode', label: 'Product Brand', placeholder: 'Kode brand' },
  { value: 'ProductModelCode', label: 'Product Model', placeholder: 'Kode model' },
  { value: 'ProductMaterialCode', label: 'Product Material', placeholder: 'Kode material' },
]

const movementWindowOptions = [
  { value: 'all', label: 'All period' },
  { value: '1m', label: '1 bulan' },
  { value: '3m', label: '3 bulan' },
  { value: '6m', label: '6 bulan' },
  { value: '12m', label: '12 bulan' },
]

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function firstNumber(summary: DbRow | undefined, keys: string[]) {
  if (!summary) return 0
  const key = keys.find((item) => summary[item] !== undefined && summary[item] !== null && summary[item] !== '')
  return key ? toNumber(summary[key]) : 0
}

function firstText(summary: DbRow | undefined, keys: string[]) {
  if (!summary) return ''
  const key = keys.find((item) => summary[item] !== undefined && summary[item] !== null && summary[item] !== '')
  return key ? String(summary[key]) : ''
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value)
}

function formatCurrency(value: number) {
  // Amount / valuasi: always 4 decimals (id-ID), no compact.
  if (!Number.isFinite(value)) return 'Rp0,0000'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatCurrencyCompact(value: number) {
  if (!Number.isFinite(value)) return 'Rp0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000_000) return `${sign}Rp${(abs / 1_000_000_000_000).toFixed(2)} T`
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(2)} M`
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1)} jt`
  return formatCurrency(value)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

function percentOf(value: number, total: number) {
  if (!total) return 0
  return (value / total) * 100
}

function currentPeriod(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period || 'Bulan berjalan'
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function periodOptions(now = new Date()) {
  return Array.from({ length: 18 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = currentPeriod(date)
    return {
      value,
      label: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
    }
  })
}

function cleanFilterValue(value: string) {
  return value.trim()
}

function appendParam(params: Record<string, string>, key: string, value: string | undefined) {
  if (value) params[key] = value
}

function analysisScopeParams(filters: ProcurementKpiFilters) {
  const value = cleanFilterValue(filters.scopeCode)
  const params: Record<string, string> = {}
  if (!value) return params

  if (filters.groupBy === 'StockAnalysisCode') {
    params.stockAnalysis = value
    params.category = value
  } else if (filters.groupBy === 'ProductTypeCode') {
    params.productType = value
  } else if (filters.groupBy === 'ProductCategoryCode') {
    params.productCategory = value
    params.category = value
  } else if (filters.groupBy === 'ProductBrandCode') {
    params.productBrand = value
  } else if (filters.groupBy === 'ProductModelCode') {
    params.productModel = value
  } else if (filters.groupBy === 'ProductMaterialCode') {
    params.productMaterial = value
  }

  return params
}

function procurementFilterParams(filters: ProcurementKpiFilters, options: { includeGroupBy?: boolean; includeMovement?: boolean } = {}) {
  const params: Record<string, string> = {
    period: filters.period,
    ...analysisScopeParams(filters),
  }
  appendParam(params, 'location', cleanFilterValue(filters.location))
  appendParam(params, 'itemType', filters.itemType)
  if (options.includeMovement) appendParam(params, 'movementWindow', filters.movementWindow || 'all')
  if (options.includeGroupBy) {
    params.groupBy = filters.groupBy
    params.chartDimension = filters.groupBy
  }
  return params
}

function hrefWithFilters(
  href: string,
  filters: ProcurementKpiFilters,
  options: { forceMovement?: boolean; includeGroupBy?: boolean } = {},
) {
  const [path, rawQuery = ''] = href.split('?')
  const params = new URLSearchParams(rawQuery)
  const filterParams = procurementFilterParams(filters, {
    includeGroupBy: options.includeGroupBy !== false,
    includeMovement: options.forceMovement,
  })
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return `${path}?${params.toString()}`
}

type CardTitleTone = {
  pillClass: string
  dotClass: string
}

function cardTitleTone(cardId: string): CardTitleTone {
  switch (cardId) {
    case 'stock':
      return { pillClass: 'border-emerald-200/35 bg-emerald-400/15 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,.12)]', dotClass: 'bg-emerald-200' }
    case 'gudang-value':
      return { pillClass: 'border-teal-200/35 bg-teal-400/15 text-teal-50 shadow-[0_0_0_1px_rgba(45,212,191,.12)]', dotClass: 'bg-teal-200' }
    case 'workshop':
      return { pillClass: 'border-orange-200/35 bg-orange-400/15 text-orange-50 shadow-[0_0_0_1px_rgba(251,146,60,.12)]', dotClass: 'bg-orange-200' }
    case 'receive-value':
      return { pillClass: 'border-sky-200/35 bg-sky-400/15 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,.12)]', dotClass: 'bg-sky-200' }
    case 'pr-outstanding':
      return { pillClass: 'border-amber-200/35 bg-amber-400/15 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,.12)]', dotClass: 'bg-amber-200' }
    case 'po-outstanding':
      return { pillClass: 'border-yellow-200/35 bg-yellow-400/15 text-yellow-50 shadow-[0_0_0_1px_rgba(250,204,21,.12)]', dotClass: 'bg-yellow-200' }
    case 'movement-total':
      return { pillClass: 'border-rose-200/35 bg-rose-400/15 text-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,.12)]', dotClass: 'bg-rose-200' }
    case 'movement-qty':
      return { pillClass: 'border-lime-200/35 bg-lime-400/15 text-lime-50 shadow-[0_0_0_1px_rgba(163,230,53,.12)]', dotClass: 'bg-lime-200' }
    case 'movement-amount':
      return { pillClass: 'border-cyan-200/35 bg-cyan-400/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,.12)]', dotClass: 'bg-cyan-200' }
    case 'movement-frequency':
      return { pillClass: 'border-pink-200/35 bg-pink-400/15 text-pink-50 shadow-[0_0_0_1px_rgba(244,114,182,.12)]', dotClass: 'bg-pink-200' }
    case 'movement-open-close-qty':
      return { pillClass: 'border-indigo-200/35 bg-indigo-400/15 text-indigo-50 shadow-[0_0_0_1px_rgba(129,140,248,.12)]', dotClass: 'bg-indigo-200' }
    case 'movement-gr-qty':
      return { pillClass: 'border-teal-200/35 bg-teal-400/15 text-teal-50 shadow-[0_0_0_1px_rgba(45,212,191,.12)]', dotClass: 'bg-teal-200' }
    case 'movement-issued-split':
      return { pillClass: 'border-orange-200/35 bg-orange-400/15 text-orange-50 shadow-[0_0_0_1px_rgba(251,146,60,.12)]', dotClass: 'bg-orange-200' }
    case 'movement-top-frequency':
      return { pillClass: 'border-purple-200/35 bg-purple-400/15 text-purple-50 shadow-[0_0_0_1px_rgba(192,132,252,.12)]', dotClass: 'bg-purple-200' }
    case 'net-flow':
      return { pillClass: 'border-violet-200/35 bg-violet-400/15 text-violet-50 shadow-[0_0_0_1px_rgba(167,139,250,.12)]', dotClass: 'bg-violet-200' }
    case 'total-usage':
      return { pillClass: 'border-fuchsia-200/35 bg-fuchsia-400/15 text-fuchsia-50 shadow-[0_0_0_1px_rgba(232,121,249,.12)]', dotClass: 'bg-fuchsia-200' }
    default:
      return { pillClass: 'border-white/15 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,.08)]', dotClass: 'bg-white/80' }
  }
}

function sqlGatewayBase() {
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

async function fetchSummary(
  source: ReportSource,
  report: string,
  signal: AbortSignal,
  extra: Record<string, string> = {},
): Promise<Snapshot> {
  const params = new URLSearchParams({
    report,
    source,
    page: '1',
    pageSize: '5',
    limit: '5',
    ...extra,
  })
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, {
    cache: 'no-store',
    signal,
    headers: { 'x-sql-gateway-base': sqlGatewayBase() },
  })
  const data = await response.json().catch(() => ({})) as {
    success?: boolean
    data?: { summary?: DbRow; chart?: DbRow[] }
  }
  if (!response.ok || data.success !== true || !data.data?.summary) {
    return { ok: false, summary: {} }
  }
  const summary = data.data.summary
  return {
    ok: true,
    summary,
    chart: data.data.chart ?? [],
    updatedAt: firstText(summary, ['TerakhirUpdate', 'LastMovementDate', 'LastUsageDate', 'LastRunningUpdate']),
  }
}

/** Fallback: jalur 8-fetch paralel lama (dipakai bila composite endpoint gagal). */
async function fetchDeckLegacy(
  source: ReportSource,
  filters: ProcurementKpiFilters,
  signal: AbortSignal,
): Promise<Partial<Record<KpiKey, Snapshot>>> {
  const baseParams = procurementFilterParams(filters)
  const results = await Promise.allSettled(kpiRequests.map(async (request) => {
    let extra: Record<string, string> = { ...baseParams }
    // GUARDRAIL(procurement-kpi-inventory-scope):
    // Stock KPI is the Procurement > Inventory master value, not Gudang-only.
    // Leave stock/movement without itemType so API uses ItemType IN ('1','4').
    if (request.key === 'workshop') {
      extra = {
        ...extra,
        itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop',
      }
    } else if (request.key === 'movement') {
      extra = {
        ...extra,
        ...analysisScopeParams(filters),
        groupBy: 'MovementCategory',
        chartDimension: 'MovementCategory',
        movementWindow: filters.movementWindow || 'all',
      }
    }
    return [request.key, await fetchSummary(source, request.report, signal, extra)] as const
  }))
  const snapshots: Partial<Record<KpiKey, Snapshot>> = {}
  results.forEach((result, index) => {
    const key = kpiRequests[index].key
    snapshots[key] = result.status === 'fulfilled'
      ? result.value[1]
      : { ok: false, summary: {} }
  })
  return snapshots
}

/**
 * Jalur utama: SATU fetch ke composite command-deck endpoint (server menjalankan
 * 8 report secara server-side). Fallback ke jalur 8-fetch lama bila endpoint gagal.
 */
async function fetchDeck(
  source: ReportSource,
  filters: ProcurementKpiFilters,
  signal: AbortSignal,
): Promise<Partial<Record<KpiKey, Snapshot>>> {
  const params = new URLSearchParams({
    source,
    period: filters.period,
    movementWindow: filters.movementWindow || 'all',
    groupBy: filters.groupBy,
    scopeCode: cleanFilterValue(filters.scopeCode),
    itemType: filters.itemType,
    location: cleanFilterValue(filters.location),
  })
  // Mode tahun custom: override period dengan rentang tanggal setahun penuh
  // (dipakai handler usage/pengeluaran-barang; snapshot valuasi bulanan tidak
  // mendukung rentang tahun — lihat catatan plan).
  const customYear = (filters.customYear ?? '').trim()
  if (filters.periodMode === 'year' && /^\d{4}$/.test(customYear)) {
    params.set('dateFrom', `${customYear}-01-01`)
    params.set('dateTo', `${customYear}-12-31`)
    params.delete('period')
  }
  try {
    const response = await fetch(`/api/reports/procurement/command-deck?${params.toString()}`, {
      cache: 'no-store',
      signal,
      headers: { 'x-sql-gateway-base': sqlGatewayBase() },
    })
    if (!response.ok) throw new Error(`command-deck ${response.status}`)
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean
      snapshots?: Partial<Record<KpiKey, Snapshot>>
    }
    if (data.success !== true || !data.snapshots) throw new Error('command-deck payload invalid')
    return data.snapshots
  } catch (error) {
    if (signal.aborted) throw error
    return fetchDeckLegacy(source, filters, signal)
  }
}

const DEFAULT_PROCUREMENT_KPI_FILTERS: ProcurementKpiFilters = {
  period: '', // filled at runtime via currentPeriod()
  movementWindow: 'all',
  groupBy: 'ProductTypeCode',
  scopeCode: '',
  itemType: '',
  location: '',
  periodMode: 'month',
  customYear: '',
}

export function createDefaultProcurementKpiFilters(now = new Date()): ProcurementKpiFilters {
  return {
    ...DEFAULT_PROCUREMENT_KPI_FILTERS,
    period: currentPeriod(now),
  }
}

export default function ProcurementKpiStrip({
  source,
  links,
  filters: controlledFilters,
  onFiltersChange,
}: ProcurementKpiStripProps) {
  const [localFilters, setLocalFilters] = useState<ProcurementKpiFilters>(() => createDefaultProcurementKpiFilters())
  const filters = controlledFilters ?? localFilters
  const setFilters = (next: ProcurementKpiFilters | ((current: ProcurementKpiFilters) => ProcurementKpiFilters)) => {
    const resolved = typeof next === 'function' ? next(filters) : next
    if (onFiltersChange) onFiltersChange(resolved)
    else setLocalFilters(resolved)
  }
  const [state, setState] = useState<KpiState>(() => ({
    source,
    loading: true,
    snapshots: {},
  }))
  const [scopeDraft, setScopeDraft] = useState(filters.scopeCode)
  const [openSection, setOpenSection] = useState<DeckSection>('valuasi')
  const [topDimension, setTopDimension] = useState<'items' | 'costCenters' | 'vehicles'>('items')
  const selectedGroup = analysisGroupOptions.find((option) => option.value === filters.groupBy) ?? analysisGroupOptions[0]
  const periods = periodOptions()
  const isYearMode = filters.periodMode === 'year' && /^\d{4}$/.test((filters.customYear ?? '').trim())
  const activePeriodLabel = isYearMode
    ? `Tahun ${(filters.customYear ?? '').trim()}`
    : formatPeriodLabel(filters.period)
  const filteredLinks = {
    stock: hrefWithFilters(links.stock, filters, { includeGroupBy: false }),
    receive: hrefWithFilters(links.receive, filters, { includeGroupBy: false }),
    process: hrefWithFilters(links.process, filters, { includeGroupBy: false }),
    workshop: hrefWithFilters(links.workshop, {
      ...filters,
      itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop',
    }, { includeGroupBy: false }),
    movement: hrefWithFilters(links.movement, filters, { forceMovement: true, includeGroupBy: false }),
    usage: hrefWithFilters(links.usage, filters, { includeGroupBy: false }),
    return: hrefWithFilters(links.return, filters, { includeGroupBy: false }),
  }
  const updateFilter = <K extends keyof ProcurementKpiFilters>(key: K, value: ProcurementKpiFilters[K]) => {
    setFilters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'groupBy') {
        next.scopeCode = ''
        setScopeDraft('')
      }
      return next
    })
  }
  const resetFilters = () => {
    const defaults = createDefaultProcurementKpiFilters()
    setScopeDraft(defaults.scopeCode)
    setFilters(defaults)
  }

  useEffect(() => {
    setScopeDraft(filters.scopeCode)
  }, [filters.scopeCode])

  useEffect(() => {
    if (scopeDraft === filters.scopeCode) return
    const timer = window.setTimeout(() => {
      updateFilter('scopeCode', scopeDraft)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scopeDraft, filters.scopeCode])

  useEffect(() => {
    const controller = new AbortController()
    startTransition(() => setState((current) => ({
      source,
      loading: true,
      snapshots: current.source === source ? current.snapshots : {},
    })))

    fetchDeck(source, filters, controller.signal)
      .then((snapshots) => {
        if (controller.signal.aborted) return
        startTransition(() => setState({ source, loading: false, snapshots }))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        startTransition(() => setState({ source, loading: false, snapshots: {} }))
      })

    return () => controller.abort()
  }, [filters, source])

  const loading = state.source !== source || state.loading
  const snapshots = state.source === source ? state.snapshots : {}
  const stock = snapshots.stock?.summary
  const receive = snapshots.receive?.summary
  const po = snapshots.po?.summary
  const pr = snapshots.pr?.summary
  const workshop = snapshots.workshop?.summary
  const movement = snapshots.movement?.summary
  const movementMonthly = snapshots.movementMonthly?.summary
  const usage = snapshots.usage?.summary
  const stockReturn = snapshots.return?.summary
  const topUsageItems = (snapshots.usage?.chart ?? []).slice(0, 5)

  const poCount = firstNumber(po, ['TotalPO'])
  const prCount = firstNumber(pr, ['TotalPR'])
  const processOutstanding = firstNumber(pr, ['TotalQtyOutstanding']) + firstNumber(po, ['TotalQtyOutstanding'])
  const gudangValue = firstNumber(stock, ['GudangTotalAmount'])
  const workshopValueFromStock = firstNumber(stock, ['WorkshopTotalAmount'])
  const workshopValue = filters.itemType === 'gudang'
    ? workshopValueFromStock
    : workshopValueFromStock || firstNumber(workshop, ['total_amount', 'WorkshopTotalAmount', 'NilaiPersediaan', 'TotalAmount'])
  const inventoryValue = firstNumber(stock, ['total_amount', 'TotalAssetAmount', 'NilaiPersediaan', 'TotalAmount']) || gudangValue + workshopValue
  const totalInventoryItem = firstNumber(stock, ['total_item', 'TotalItem'])
  const gudangItem = firstNumber(stock, ['GudangItemCount'])
  const workshopItem = firstNumber(stock, ['WorkshopItemCount'])
  const totalQuantity = firstNumber(stock, ['total_quantity', 'TotalQty', 'TotalStok'])
  const totalOnHand = firstNumber(stock, ['total_quantity_on_hand'])
  const totalOnHold = firstNumber(stock, ['total_quantity_on_hold'])
  const receiveDocs = firstNumber(receive, ['TotalGoodsReceive', 'TotalBaris'])
  const receiveQty = firstNumber(receive, ['TotalQuantity'])
  const receiveAmount = firstNumber(receive, ['TotalAmount'])
  const receiveSupplier = firstNumber(receive, ['TotalSupplier'])
  const poAmount = firstNumber(po, ['TotalPOAmount'])
  const poQtyOrder = firstNumber(po, ['TotalQtyOrder'])
  const poQtyReceive = firstNumber(po, ['TotalQtyReceive'])
  const poQtyOutstanding = firstNumber(po, ['TotalQtyOutstanding'])
  const prAmount = firstNumber(pr, ['TotalAmount'])
  const prQtyRequest = firstNumber(pr, ['TotalQtyRequest'])
  const prQtyReceived = firstNumber(pr, ['TotalQtyReceived'])
  const prQtyOutstanding = firstNumber(pr, ['TotalQtyOutstanding'])
  const movementEvent = firstNumber(movement, ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'])
  const movementQty = firstNumber(movement, ['TotalStockIssueMovementQty', 'TotalStockIssueQty'])
  const movementAmount = firstNumber(movement, ['TotalStockIssueMovementAmount', 'TotalStockIssueAmount'])
  const usageDocuments = firstNumber(usage, ['TotalDokumen', 'TotalIssueDocuments'])
  const usageEvents = firstNumber(usage, ['TotalBaris', 'TotalIssueEvents'])
  const usageItems = firstNumber(usage, ['TotalItem', 'TotalItemsUsed'])
  const usageQty = firstNumber(usage, ['TotalQty', 'TotalIssueQty']) || movementQty
  const usageAmount = firstNumber(usage, ['TotalAmount', 'TotalIssueAmount']) || movementAmount
  const returnAmount = firstNumber(stockReturn, ['TotalAmount', 'TotalReturnAmount'])
  const netFlowAmount = receiveAmount - usageAmount + returnAmount
  const regularMovement = firstNumber(movement, ['RegularStockIssueMovementCount'])
  const workshopMovement = firstNumber(movement, ['WorkshopStockIssueMovementCount'])
  const usageIntensity = inventoryValue > 0 ? usageAmount / inventoryValue : 0
  const activeIssueDays = firstNumber(usage, ['ActiveIssueDays'])
  const usageFreqPerDay = frequencyPerDay(usageEvents, activeIssueDays)
  const returnRateValue = returnRate(returnAmount, usageAmount)
  const topLists = snapshots.usage?.topLists
  const topDimensionRows = topLists?.[topDimension] ?? []
  const topRows = topDimensionRows.length > 0 ? topDimensionRows.slice(0, 5) : topUsageItems
  const TOP_DIMENSIONS: { id: 'items' | 'costCenters' | 'vehicles'; label: string }[] = [
    { id: 'items', label: 'Item' },
    { id: 'costCenters', label: 'Dept' },
    { id: 'vehicles', label: 'Kendaraan' },
  ]
  const usageTrend = snapshots.usage?.trend ?? []
  const issueFrequency = snapshots.usage?.issueFrequency
  const issueFrequencyTop = (issueFrequency?.topItems ?? []).slice(0, 5)
  const monthlyOpeningQty = firstNumber(movementMonthly, ['OpeningQty'])
  const monthlyClosingQty = firstNumber(movementMonthly, ['ClosingQty'])
  const monthlyGoodsReceiveQty = firstNumber(movementMonthly, ['GoodsReceiveQty'])
  const monthlyLedgerQty = firstNumber(movementMonthly, ['LedgerQty'])
  const monthlyIssuedStationQty = firstNumber(movementMonthly, ['IssuedStationQty'])
  const monthlyIssuedVehicleQty = firstNumber(movementMonthly, ['IssuedVehicleQty'])
  const monthlyIssuedTotalQty = firstNumber(movementMonthly, ['IssuedTotalQty'])
  const monthlyQtyDelta = monthlyClosingQty - monthlyOpeningQty
  const hasMovementMonthly = monthlyOpeningQty + monthlyGoodsReceiveQty + monthlyLedgerQty + monthlyIssuedStationQty + monthlyIssuedVehicleQty + monthlyClosingQty > 0
  const insightItems = (() => {
    const items: string[] = []
    const trend = Array.isArray(usageTrend) ? usageTrend : []
    const last = trend.length > 0 ? Number((trend[trend.length - 1] as { qty?: number; quantity?: number })?.qty ?? (trend[trend.length - 1] as { quantity?: number })?.quantity ?? 0) : 0
    const prev3 = trend.slice(-4, -1).map((row) => Number((row as { qty?: number; quantity?: number })?.qty ?? (row as { quantity?: number })?.quantity ?? 0))
    const avg3 = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0
    if (avg3 > 0 && last > 0) {
      const pct = Math.round(((last - avg3) / avg3) * 100)
      if (pct !== 0) items.push(`Qty issue ${pct > 0 ? '+' : ''}${pct}% vs rata-rata 3 bulan`)
    }
    if (monthlyClosingQty > 0 && monthlyOpeningQty > 0 && monthlyClosingQty < monthlyOpeningQty) {
      items.push('Closing qty di bawah opening periode ini')
    }
    const topNames = new Set((topLists?.items ?? []).map((it) => String((it as { name?: string })?.name ?? '')))
    const fresh = (issueFrequency?.topItems ?? []).filter((it) => !topNames.has(String((it as { name?: string })?.name ?? '')))
    if (fresh.length > 0 && topNames.size > 0) items.push(`${fresh.length} item baru masuk Top movement`)
    if (usageDocuments > 0) items.push(`${formatNumber(usageDocuments)} dokumen issue · ${formatNumber(activeIssueDays)} hari aktif`)
    return items.slice(0, 5)
  })()

  const topIssueFreq = issueFrequencyTop[0]
  const topIssueFreqDocs = topIssueFreq ? Number(topIssueFreq.docs) || 0 : 0
  const flowStages: FlowStage[] = [
    {
      id: 'pr',
      label: 'PR',
      value: loading ? '…' : formatNumber(prCount),
      hint: `Req ${formatQuantity(prQtyRequest)} · Out ${formatQuantity(prQtyOutstanding)}`,
      tone: 'pr',
    },
    {
      id: 'po',
      label: 'PO',
      value: loading ? '…' : formatNumber(poCount),
      hint: `Order ${formatQuantity(poQtyOrder)} · Fill ${formatPercent(poFillRate(poQtyReceive, poQtyOrder) * 100)}`,
      tone: 'po',
    },
    {
      id: 'gr',
      label: 'Receive',
      value: loading ? '…' : formatNumber(receiveDocs),
      hint: `Qty ${formatQuantity(receiveQty)} · ${formatCurrencyCompact(receiveAmount)}`,
      tone: 'gr',
    },
    {
      id: 'issue',
      label: 'Issue',
      value: loading ? '…' : formatNumber(usageDocuments),
      hint: `Qty ${formatQuantity(usageQty)} · ${formatCurrencyCompact(usageAmount)}`,
      tone: 'issue',
    },
    {
      id: 'return',
      label: 'Return',
      value: loading ? '…' : formatCurrencyCompact(returnAmount),
      hint: `Rate ${formatPercent(returnRateValue * 100)} (all-time)`,
      tone: 'return',
    },
  ]
  const flowLinks: Record<string, string> = {
    pr: filteredLinks.process,
    po: filteredLinks.process,
    gr: filteredLinks.receive,
    issue: filteredLinks.usage,
    return: filteredLinks.return,
  }

  const valuationCards: ProcurementKpiCard[] = [
    {
      id: 'stock',
      label: 'Total Valuasi Inventory',
      value: formatCurrencyCompact(inventoryValue),
      valueExact: formatCurrency(inventoryValue),
      description: 'Total inventory stock value in IDR for ItemType 1 + 4.',
      formula: 'Stock value = SUM((Qty On Hand + Qty On Hold) × Average Cost) for Gudang + Workshop/Mesin.',
      source: 'asset-stock-valuasi-listing',
      breakdown: [
        { label: 'Gudang', value: `${formatCurrency(gudangValue)} · ${formatPercent(percentOf(gudangValue, inventoryValue))}` },
        { label: 'Workshop', value: `${formatCurrency(workshopValue)} · ${formatPercent(percentOf(workshopValue, inventoryValue))}` },
        { label: 'Item valuasi', value: formatNumber(totalInventoryItem) },
      ],
      href: filteredLinks.stock,
      icon: Package,
      className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    },
    {
      id: 'gudang-value',
      label: 'Valuasi Gudang',
      value: formatCurrency(gudangValue),
      description: 'Gudang stock value in IDR for ItemType 1.',
      formula: 'Stock value = SUM(total_amount) where ItemType = 1. Qty chips show on hand and on hold.',
      source: 'asset-stock-valuasi-listing · Gudang',
      breakdown: [
        { label: 'Item Gudang', value: formatNumber(gudangItem) },
        { label: 'Qty on hand', value: formatQuantity(totalOnHand) },
        { label: 'Qty on hold', value: formatQuantity(totalOnHold) },
      ],
      href: filteredLinks.stock,
      icon: Layers3,
      className: 'border-teal-300/25 bg-teal-400/10 text-teal-100',
    },
    {
      id: 'workshop',
      label: 'Valuasi Workshop',
      value: formatCurrency(workshopValue),
      description: 'Workshop/Mesin stock value in IDR for ItemType 4.',
      formula: 'Stock value = SUM(total_amount) where ItemType = 4. Quantity chip shows physical stock scope.',
      source: 'asset-stock-valuasi-listing · Workshop',
      breakdown: [
        { label: 'Item Workshop', value: formatNumber(workshopItem || firstNumber(workshop, ['total_item', 'WorkshopItemCount', 'TotalItem'])) },
        { label: 'Total quantity', value: formatQuantity(totalQuantity) },
        { label: 'Lokasi', value: formatNumber(firstNumber(stock, ['total_location', 'TotalGudang'])) },
      ],
      href: filteredLinks.workshop,
      icon: Wrench,
      className: 'border-orange-300/25 bg-orange-400/10 text-orange-100',
    },
  ]

  const processCards: ProcurementKpiCard[] = [
    {
      id: 'receive-value',
      label: 'Nilai Goods Receive',
      value: formatCurrency(receiveAmount),
      description: 'Goods Receive amount in IDR for selected period.',
      formula: 'Goods Receive amount = SUM(Receive Qty × PO Cost). Qty chip shows received quantity.',
      source: 'goods-receiving-receipt-activity',
      breakdown: [
        { label: 'Dokumen receive', value: formatNumber(receiveDocs) },
        { label: 'Qty receive', value: formatQuantity(receiveQty) },
        { label: 'Supplier aktif', value: formatNumber(receiveSupplier) },
      ],
      href: filteredLinks.receive,
      icon: Truck,
      className: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
    },
    {
      id: 'pr-outstanding',
      label: 'PR Outstanding',
      value: formatQuantity(prQtyOutstanding),
      description: 'Outstanding PR quantity not yet fulfilled.',
      formula: 'PR Outstanding = SUM(Qty Outstanding) from purchase request lines.',
      source: 'purchase-request-inventory',
      breakdown: [
        { label: 'Total PR', value: formatNumber(prCount) },
        { label: 'Qty request', value: formatQuantity(prQtyRequest) },
        { label: 'Nilai PR', value: formatCurrency(prAmount) },
      ],
      href: filteredLinks.process,
      icon: ClipboardList,
      className: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    },
    {
      id: 'po-outstanding',
      label: 'PO Outstanding',
      value: formatQuantity(poQtyOutstanding),
      description: 'Outstanding PO quantity not yet received.',
      formula: 'PO Outstanding = SUM(Qty Order − Qty Receive). Fill rate = Qty Receive / Qty Order.',
      source: 'purchase-order-history',
      breakdown: [
        { label: 'Total PO', value: formatNumber(poCount) },
        { label: 'Qty order', value: formatQuantity(poQtyOrder) },
        { label: 'Nilai PO', value: formatCurrency(poAmount) },
        { label: 'Fill rate', value: formatPercent(poFillRate(poQtyReceive, poQtyOrder) * 100) },
      ],
      href: filteredLinks.process,
      icon: CircleDollarSign,
      className: 'border-yellow-300/25 bg-yellow-400/10 text-yellow-100',
    },
  ]

  const movementCards: ProcurementKpiCard[] = [
    {
      id: 'movement-total',
      label: 'Total Issue Movement',
      value: formatNumber(movementEvent),
      description: 'Count of issue/usage movement events in selected movement window.',
      formula: 'Event count = regular StockIssue lines + Workshop/Mesin issue lines in movement window.',
      source: 'all-stock-movement-analysis · total event',
      breakdown: [
        { label: 'Regular', value: formatNumber(regularMovement) },
        { label: 'Workshop', value: formatNumber(workshopMovement) },
        { label: 'Docs', value: formatNumber(usageDocuments) },
      ],
      href: filteredLinks.movement,
      icon: Gauge,
      className: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
    },
    {
      id: 'movement-qty',
      label: 'Issue Qty',
      value: formatQuantity(movementQty),
      description: 'Total quantity issued/used in selected period/window.',
      formula: 'Issue Qty = SUM issued physical quantity from movement and usage reports.',
      source: 'all-stock-movement-analysis · qty',
      breakdown: [
        { label: 'Usage qty', value: formatQuantity(usageQty) },
        { label: 'Event line', value: formatNumber(usageEvents) },
        { label: 'Issue docs', value: formatNumber(usageDocuments) },
      ],
      href: filteredLinks.movement,
      icon: Package,
      className: 'border-lime-300/25 bg-lime-400/10 text-lime-100',
    },
    {
      id: 'movement-amount',
      label: 'Issue Amount',
      value: formatCurrency(movementAmount),
      description: 'Total issue/usage value in IDR.',
      formula: 'Issue Amount = SUM issued amount from movement and usage reports.',
      source: 'all-stock-movement-analysis · amount',
      breakdown: [
        { label: 'Usage amount', value: formatCurrency(usageAmount) },
        { label: 'Qty issue', value: formatQuantity(movementQty) },
        { label: 'Issue docs', value: formatNumber(usageDocuments) },
      ],
      href: filteredLinks.movement,
      icon: CircleDollarSign,
      className: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
    },
    {
      id: 'movement-frequency',
      label: 'Frekuensi Issue',
      value: formatNumber(usageDocuments),
      description: 'Jumlah dokumen issue unik dan sebaran hari aktif issue dalam periode terpilih.',
      formula: 'Frekuensi = COUNT(DISTINCT Dokumen) issue; intensitas = dokumen / hari aktif issue.',
      source: 'pengeluaran-barang · issueFrequency',
      breakdown: [
        { label: 'Hari aktif', value: formatNumber(activeIssueDays) },
        { label: 'Doc/hari', value: formatQuantity(activeIssueDays > 0 ? usageDocuments / activeIssueDays : 0) },
        { label: 'Event line', value: formatNumber(usageEvents) },
      ],
      href: filteredLinks.movement,
      icon: Gauge,
      className: 'border-pink-300/25 bg-pink-400/10 text-pink-100',
    },
    {
      id: 'movement-open-close-qty',
      label: 'Opening vs Closing Qty',
      value: formatQuantity(monthlyClosingQty),
      description: 'Quantity closing bulan berjalan dibanding opening, dari movement report bulanan.',
      formula: 'Closing Qty = SUM(ClosingQty); Opening Qty = SUM(OpeningQty); delta = closing − opening.',
      source: 'monthly-stock-account-movement-details',
      breakdown: [
        { label: 'Opening qty', value: formatQuantity(monthlyOpeningQty) },
        { label: 'Closing qty', value: formatQuantity(monthlyClosingQty) },
        { label: 'Delta', value: `${monthlyQtyDelta >= 0 ? '+' : ''}${formatQuantity(monthlyQtyDelta)}` },
      ],
      href: filteredLinks.movement,
      icon: Layers3,
      className: 'border-indigo-300/25 bg-indigo-400/10 text-indigo-100',
    },
    {
      id: 'movement-gr-qty',
      label: 'Goods Receive Qty',
      value: formatQuantity(monthlyGoodsReceiveQty),
      description: 'Total quantity barang yang diterima (goods receive) pada periode berjalan.',
      formula: 'Goods Receive Qty = SUM(GoodsReceiveQty) dari movement report bulanan.',
      source: 'monthly-stock-account-movement-details',
      breakdown: [
        { label: 'Issued total qty', value: formatQuantity(monthlyIssuedTotalQty) },
        { label: 'Net qty (GR − issued)', value: formatQuantity(monthlyGoodsReceiveQty - monthlyIssuedTotalQty) },
      ],
      href: filteredLinks.movement,
      icon: Truck,
      className: 'border-teal-300/25 bg-teal-400/10 text-teal-100',
    },
    {
      id: 'movement-issued-split',
      label: 'Issued Qty Split',
      value: formatQuantity(monthlyIssuedTotalQty),
      description: 'Rincian quantity issue: ledger, station, dan vehicle pada periode berjalan.',
      formula: 'Issued Total = Ledger + Issued Station + Issued Vehicle (qty), dari movement report bulanan.',
      source: 'monthly-stock-account-movement-details',
      breakdown: [
        { label: 'Ledger qty', value: formatQuantity(monthlyLedgerQty) },
        { label: 'Station qty', value: formatQuantity(monthlyIssuedStationQty) },
        { label: 'Vehicle qty', value: formatQuantity(monthlyIssuedVehicleQty) },
      ],
      href: filteredLinks.movement,
      icon: Package,
      className: 'border-orange-300/25 bg-orange-400/10 text-orange-100',
    },
    {
      id: 'movement-top-frequency',
      label: 'Paling Sering Di-issue',
      value: topIssueFreq ? (topIssueFreq.code ?? topIssueFreq.name ?? '—') : '—',
      description: 'Item dengan frekuensi dokumen issue tertinggi dalam periode terpilih.',
      formula: 'Top frequency = item dengan COUNT(DISTINCT Dokumen) issue terbanyak.',
      source: 'pengeluaran-barang · issueFrequency.topItems',
      breakdown: [
        { label: 'Doc issue', value: formatNumber(topIssueFreqDocs) },
        { label: 'Nama item', value: topIssueFreq?.name ?? '—' },
        { label: 'Event line', value: formatNumber(topIssueFreq ? Number(topIssueFreq.events) || 0 : 0) },
      ],
      href: filteredLinks.movement,
      icon: TrendingUp,
      className: 'border-purple-300/25 bg-purple-400/10 text-purple-100',
    },
  ]

  const heroCards: ProcurementKpiCard[] = [
    valuationCards[0],
    {
      id: 'net-flow',
      label: 'Arus Bersih Periode',
      value: formatCurrencyCompact(netFlowAmount),
      valueExact: formatCurrency(netFlowAmount),
      description: netFlowAmount >= 0 ? 'Net flow amount in IDR: receive + return is greater than issue.' : 'Net flow amount in IDR: issue is greater than receive + return.',
      formula: 'Net Flow = Goods Receive Amount − Issue Amount + Return Amount.',
      source: 'receive − pengeluaran + return',
      breakdown: [
        { label: 'Receive', value: formatCurrency(receiveAmount) },
        { label: 'Issue', value: formatCurrency(usageAmount) },
        { label: 'Return', value: formatCurrency(returnAmount) },
      ],
      href: filteredLinks.receive,
      icon: netFlowAmount >= 0 ? TrendingUp : TrendingDown,
      className: netFlowAmount >= 0 ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    },
    {
      id: 'total-usage',
      label: 'Total Usage (Issue)',
      value: formatCurrencyCompact(usageAmount),
      valueExact: formatCurrency(usageAmount),
      description: 'Total usage/issue amount in IDR for selected period.',
      formula: 'Total Usage = SUM issue Amount. Freq/hari = Issue Events / Hari Aktif. Return rate = Return / Issue.',
      source: 'pengeluaran-barang',
      breakdown: [
        { label: 'Qty issue', value: formatQuantity(usageQty) },
        { label: 'Frekuensi', value: `${formatNumber(usageEvents)} event · ${formatQuantity(usageFreqPerDay)}/hari` },
        { label: 'Item dipakai', value: formatNumber(usageItems) },
        { label: 'Intensitas', value: formatPercent(usageIntensity * 100) },
        { label: 'Return rate', value: formatPercent(returnRateValue * 100) },
      ],
      href: filteredLinks.usage,
      icon: Package,
      className: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
    },
  ]

  const partial = Object.values(snapshots).some((snapshot) => snapshot && !snapshot.ok)
  const headlineCard = heroCards[0]
  const heroSideCards = heroCards.slice(1)
  const valuationSideCards = valuationCards.slice(1)
  const gudangShare = Math.min(Math.max(percentOf(gudangValue, inventoryValue), 0), 100)
  const workshopShare = Math.min(Math.max(percentOf(workshopValue, inventoryValue), 0), 100)

  const renderCardItems = (cards: ProcurementKpiCard[]) =>
    cards.map((card, cardIndex) => {
        const Icon = card.icon
        const tone = cardTitleTone(card.id)
        const exact = card.valueExact ?? card.value
        return (
          <Link
            key={card.id}
            href={card.href}
            title={exact}
            aria-label={`${card.label}: ${exact}`}
            className="rc-kpi-surface rc-reveal group relative min-h-[150px] overflow-hidden rounded-[22px] p-3"
            style={{ '--reveal-order': cardIndex } as React.CSSProperties}
          >
            <span className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-white/10 blur-2xl transition group-hover:bg-[var(--rc-forest-primary)]/20" aria-hidden="true" />
            <span className="relative z-10 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${tone.pillClass}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dotClass}`} />
                  <span className="truncate">{card.label}</span>
                </span>
                <strong
                  className="rc-metric mt-2 block truncate text-[1.45rem] font-bold text-[var(--rc-text)]"
                  title={exact}
                >
                  {loading ? '...' : card.value}
                </strong>
              </span>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${card.className}`}>
                <Icon size={17} />
              </span>
            </span>
            <span className="relative z-10 mt-2 block truncate text-[11px] font-semibold text-[var(--rc-text-muted)]">
              {loading ? 'Menunggu response gateway' : card.description}
            </span>
            <span className="relative z-10 mt-2 flex flex-wrap gap-1.5">
              {card.breakdown.map((item) => (
                <span key={item.label} className="rc-chip max-w-full truncate">
                  <span>{item.label}: </span>
                  <strong>{loading ? '...' : item.value}</strong>
                </span>
              ))}
            </span>
            <span className="rc-hairline rc-data relative z-10 mt-2 flex items-center justify-between gap-2 pt-2 text-[10px] text-[var(--rc-text-faint)]">
              {loading ? 'Loading' : card.source}
              <ArrowRight size={13} className="text-[var(--rc-forest-accent)]" />
            </span>
          </Link>
        )
      })

  const renderCardGrid = (cards: ProcurementKpiCard[]) => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {renderCardItems(cards)}
    </div>
  )

  const sectionCards =
    openSection === 'proses' ? processCards
      : openSection === 'movement' ? movementCards
        : valuationSideCards

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[var(--rc-forest-border)] bg-[radial-gradient(circle_at_8%_0%,rgba(155,226,61,.18),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(41,199,200,.16),transparent_25%),linear-gradient(135deg,rgba(2,10,7,.94),rgba(7,25,17,.9)_46%,rgba(10,14,7,.92))] shadow-[0_26px_90px_rgba(0,0,0,.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,.08),transparent_18%,transparent_72%,rgba(155,226,61,.08))]" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-2 border-b border-[var(--rc-border)] bg-black/10 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="rc-display text-xl font-bold text-[var(--rc-text)] sm:text-2xl">Procurement command deck</h2>
          <p className="mt-1 max-w-4xl text-xs font-semibold leading-5 text-[var(--rc-text-muted)]">
            Hero always on: Total Valuasi · Arus Bersih · Total Usage. Tab secondary: Valuasi · Proses · Movement.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--rc-forest-border-strong)] bg-[rgba(155,226,61,.08)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--rc-forest-accent)]">
          {loading ? 'Mengambil summary live' : partial ? 'Live sebagian, fallback aktif' : 'Live dari SQL Gateway'}
        </span>
        <Link
          href={`/report-center/control?source=${source}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.06)] px-3 py-1.5 text-[11px] font-bold text-[var(--rc-forest-accent)] transition hover:bg-[rgba(155,226,61,.14)]"
          title="Bangun & kelola agregasi KPI bulanan pre-rendered"
        >
          Ruang kontrol agregasi
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="relative z-10 border-b border-[var(--rc-border)] bg-[rgba(2,10,7,.42)] px-3 py-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[250px_150px_190px_minmax(180px,1fr)_150px_140px_auto]">
          <div className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Periode usage/receive</span>
            <div className="flex h-10 overflow-hidden rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d]">
              <div className="flex shrink-0 items-center border-r border-[var(--rc-forest-border)]">
                {(['month', 'year'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateFilter('periodMode', mode)}
                    className={`h-full px-2 text-[9px] font-black uppercase tracking-[0.06em] transition ${
                      (filters.periodMode ?? 'month') === mode
                        ? 'bg-[var(--rc-forest-accent)] text-[#04130c]'
                        : 'text-[var(--rc-text-faint)] hover:text-[var(--rc-text)]'
                    }`}
                  >
                    {mode === 'month' ? 'Bulan' : 'Tahun'}
                  </button>
                ))}
              </div>
              {isYearMode ? (
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="2025"
                  value={filters.customYear ?? ''}
                  onChange={(event) => updateFilter('customYear', event.target.value)}
                  className="h-full w-full min-w-0 flex-1 bg-transparent px-3 text-xs font-black text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)]"
                />
              ) : (
                <select
                  value={filters.period}
                  onChange={(event) => updateFilter('period', event.target.value)}
                  className="h-full w-full min-w-0 flex-1 bg-transparent px-3 text-xs font-black text-[var(--rc-text)] outline-none"
                >
                  {periods.map((period) => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Jendela aging movement</span>
            <select
              value={filters.movementWindow}
              onChange={(event) => updateFilter('movementWindow', event.target.value)}
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none focus:border-[var(--rc-forest-accent)]"
            >
              {movementWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Analysis Group</span>
            <select
              value={filters.groupBy}
              onChange={(event) => updateFilter('groupBy', event.target.value as ProcurementAnalysisGroup)}
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none focus:border-[var(--rc-forest-accent)]"
            >
              {analysisGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Kode Filter</span>
            <input
              value={scopeDraft}
              onChange={(event) => setScopeDraft(event.target.value)}
              placeholder={selectedGroup.placeholder}
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-[var(--rc-forest-accent)]"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Item Scope</span>
            <select
              value={filters.itemType}
              onChange={(event) => updateFilter('itemType', event.target.value as ProcurementKpiFilters['itemType'])}
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none focus:border-[var(--rc-forest-accent)]"
            >
              <option value="">Inventory 1+4</option>
              <option value="gudang">Gudang</option>
              <option value="workshop">Workshop/Mesin</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Lokasi</span>
            <input
              value={filters.location}
              onChange={(event) => updateFilter('location', event.target.value)}
              placeholder="PTRJ / lokasi"
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-[var(--rc-forest-accent)]"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 w-full rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.045] px-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.08] hover:text-[var(--rc-text)]"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--rc-text-faint)]" aria-label="Active filter context">
          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-100" title="Periode usage/receive">
            Period {activePeriodLabel}{isYearMode ? '' : ` · ${filters.period}`}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">MC {filters.movementWindow}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Group {selectedGroup.label}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">{filters.itemType ? `Scope ${filters.itemType}` : 'Scope Inventory 1+4'}</span>
          {filters.scopeCode ? <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-lime-100">Code {filters.scopeCode}</span> : null}
          {filters.location ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">Lokasi {filters.location}</span> : null}
        </div>

        {insightItems.length > 0 ? (
          <div className="mt-2">
            <InsightTicker items={insightItems} />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 border-b border-[var(--rc-border)] px-3 py-3">
        <p className="mb-2 text-[11px] font-semibold text-[var(--rc-text-faint)]">Alur proses — klik tahap untuk buka detail</p>
        <ProcurementFlowStrip
          stages={flowStages}
          onSelect={(stageId) => {
            const href = flowLinks[stageId]
            if (href) window.location.href = href
          }}
        />
      </div>

      <div className="relative z-10 grid gap-3 p-3 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.7fr)]">
        {headlineCard ? (
          <Link
            href={headlineCard.href}
            title={headlineCard.valueExact ?? headlineCard.value}
            aria-label={`${headlineCard.label}: ${headlineCard.valueExact ?? headlineCard.value}`}
            className="rc-reveal group relative min-h-[222px] overflow-hidden rounded-[28px] border border-emerald-300/25 bg-[linear-gradient(145deg,rgba(24,185,107,.2),rgba(4,18,12,.72)_52%,rgba(214,184,92,.13))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)]"
          >
            <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl transition group-hover:bg-lime-300/25" aria-hidden="true" />
            <span className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-[linear-gradient(90deg,rgba(155,226,61,.14),transparent)]" aria-hidden="true" />

            <span className="relative z-10 flex items-start justify-between gap-3">
              <span>
                <span className="block text-[11px] font-semibold text-emerald-100/60">Master valuation</span>
                <strong
                  className="rc-metric mt-2 block text-[2.35rem] font-bold text-[var(--rc-text)] sm:text-5xl"
                  title={headlineCard.valueExact ?? headlineCard.value}
                >
                  {loading ? '...' : headlineCard.value}
                </strong>
              </span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10 text-emerald-100">
                <Package size={22} />
              </span>
            </span>

            <span className="relative z-10 mt-3 block text-xs font-semibold leading-5 text-emerald-50/70">
              {headlineCard.formula}
            </span>

            <span className="relative z-10 mt-4 grid gap-2">
              <span className="flex items-center justify-between gap-3 text-[11px] font-black text-emerald-50/80">
                <span>Gudang</span>
                <span title={formatCurrency(gudangValue)}>{loading ? '...' : `${formatCurrencyCompact(gudangValue)} · ${formatPercent(gudangShare)}`}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#18b96b,#9be23d)]" style={{ width: `${gudangShare}%` }} />
              </span>
              <span className="flex items-center justify-between gap-3 text-[11px] font-black text-amber-50/80">
                <span>Workshop/Mesin</span>
                <span title={formatCurrency(workshopValue)}>{loading ? '...' : `${formatCurrencyCompact(workshopValue)} · ${formatPercent(workshopShare)}`}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#d6b85c)]" style={{ width: `${workshopShare}%` }} />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] font-bold text-emerald-50/60">
              {headlineCard.source}
              <ArrowRight size={13} className="text-[var(--rc-forest-accent)]" />
            </span>
          </Link>
        ) : null}

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">Always visible · Arus Bersih + Total Usage</p>
            {renderCardGrid(heroSideCards)}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="KPI secondary sections">
              {DECK_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={openSection === section.id}
                  data-active={openSection === section.id}
                  onClick={() => setOpenSection(section.id)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-white/[0.06] ${section.tone}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={`Section ${openSection}`}>
              <KpiCarousel ariaLabel={`KPI section ${openSection}`}>
                {renderCardItems(sectionCards)}
              </KpiCarousel>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
        <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 2 } as React.CSSProperties}>
          <div className="h-[240px]">
            <MovementTrendChart trend={usageTrend} frequency={issueFrequency?.byMonth} loading={loading} />
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
        <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 3 } as React.CSSProperties}>
          <div className="h-[260px]">
            <TopMovementScatter
              items={issueFrequencyTop.length > 0 ? issueFrequencyTop : (topLists?.items ?? [])}
              loading={loading}
              top={10}
            />
          </div>
        </div>
      </div>

      {hasMovementMonthly ? (
        <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
          <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 4 } as React.CSSProperties}>
            <div className="h-[280px]">
              <StockRiverChart
                opening={monthlyOpeningQty}
                goodsReceive={monthlyGoodsReceiveQty}
                ledger={monthlyLedgerQty}
                station={monthlyIssuedStationQty}
                vehicle={monthlyIssuedVehicleQty}
                closing={monthlyClosingQty}
                loading={loading}
              />
            </div>
          </div>
        </div>
      ) : null}

      {topRows.length > 0 ? (
        <div className="relative z-10 border-t border-[var(--rc-border)] bg-black/15 px-3 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-cyan-100/70">Top usage periode</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--rc-text-muted)]">Top 5 dari report pengeluaran-barang. AccCode dibaca sebagai cost center / dept.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Dimensi top usage">
              {TOP_DIMENSIONS.map((dim) => (
                <button
                  key={dim.id}
                  type="button"
                  role="tab"
                  aria-selected={topDimension === dim.id}
                  data-active={topDimension === dim.id}
                  onClick={() => setTopDimension(dim.id)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition hover:bg-white/[0.06] ${
                    topDimension === dim.id
                      ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-[var(--rc-text-muted)]'
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
            <Link href={filteredLinks.usage} className="inline-flex w-fit items-center gap-1.5 rounded-xl border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/15">
              Buka detail issue
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {topRows.map((item, index) => {
              const amount = firstNumber(item, ['amount', 'NilaiKeluar', 'Amount', 'TotalAmount'])
              const qty = firstNumber(item, ['qty', 'QtyKeluar', 'Qty', 'TotalQty'])
              const label = firstText(item, ['name', 'NamaBarang', 'ItemName', 'KodeBarang', 'code']) || `${topDimension === 'items' ? 'Item' : topDimension === 'costCenters' ? 'Dept' : 'Kendaraan'} ${index + 1}`
              const code = firstText(item, ['code', 'KodeBarang'])
              return (
                <Link
                  key={`${topDimension}-${index}-${label}`}
                  href={filteredLinks.usage}
                  className="rounded-2xl border-white/10 bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/10"
                >
                  <span className="block truncate text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/60">#{index + 1} · {code || (topDimension === 'items' ? 'item' : topDimension === 'costCenters' ? 'dept' : 'unit')}</span>
                  <strong className="mt-1 block line-clamp-2 text-sm font-black leading-5 text-[var(--rc-text)]">{label}</strong>
                  <span className="mt-2 block text-xs font-bold text-cyan-100">{formatCurrency(amount)}</span>
                  <span className="text-[11px] font-semibold text-[var(--rc-text-faint)]">
                    {topDimension === 'items' ? `Qty ${formatQuantity(qty)}` : `${formatNumber(firstNumber(item, ['events']))} event`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
