'use client'

import Link from 'next/link'
import { startTransition, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CircleDollarSign, ClipboardList, Gauge, Layers3, Package, Truck, Wrench } from 'lucide-react'
import type { ReportSource } from '@/lib/reports/procurement-workspace'

type DbRow = Record<string, unknown>

type KpiKey = 'stock' | 'receive' | 'po' | 'pr' | 'workshop' | 'movement'

type Snapshot = {
  ok: boolean
  summary: DbRow
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
  | 'MovementCategory'

export type ProcurementKpiFilters = {
  period: string
  movementWindow: string
  groupBy: ProcurementAnalysisGroup
  scopeCode: string
  itemType: '' | 'gudang' | 'workshop'
  location: string
}

type ProcurementKpiStripProps = {
  source: ReportSource
  links: Record<'stock' | 'receive' | 'process' | 'workshop' | 'movement', string>
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
  description: string
  formula: string
  source: string
  breakdown: ProcurementKpiBreakdown[]
  href: string
  icon: typeof Package
  className: string
}

const kpiRequests: Array<{ key: KpiKey; report: string }> = [
  { key: 'stock', report: 'asset-stock-valuasi-listing' },
  { key: 'receive', report: 'goods-receiving-receipt-activity' },
  { key: 'po', report: 'purchase-order-history' },
  { key: 'pr', report: 'purchase-request-inventory' },
  { key: 'workshop', report: 'asset-stock-valuasi-listing' },
  { key: 'movement', report: 'all-stock-movement-analysis' },
]

const analysisGroupOptions: Array<{ value: ProcurementAnalysisGroup; label: string; placeholder: string }> = [
  { value: 'StockAnalysisCode', label: 'Stock Analysis', placeholder: 'DEADS / MEMOV / SLMOV' },
  { value: 'ProductTypeCode', label: 'Product Type', placeholder: 'Contoh: SP / FUEL' },
  { value: 'ProductCategoryCode', label: 'Product Category', placeholder: 'Kode kategori produk' },
  { value: 'ProductBrandCode', label: 'Product Brand', placeholder: 'Kode brand' },
  { value: 'ProductModelCode', label: 'Product Model', placeholder: 'Kode model' },
  { value: 'ProductMaterialCode', label: 'Product Material', placeholder: 'Kode material' },
  { value: 'MovementCategory', label: 'Movement Actual', placeholder: 'Fast Moving / Dead Stock' },
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

function periodOptions(now = new Date()) {
  return Array.from({ length: 8 }).map((_, index) => {
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

function analysisScopeParams(filters: ProcurementKpiFilters, options: { includeMovementCategory?: boolean } = {}) {
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
  } else if (filters.groupBy === 'MovementCategory' && options.includeMovementCategory) {
    params.movementCategory = value
  }

  return params
}

function procurementFilterParams(filters: ProcurementKpiFilters, options: { includeGroupBy?: boolean; includeMovement?: boolean } = {}) {
  const params: Record<string, string> = {
    period: filters.period,
    ...analysisScopeParams(filters, { includeMovementCategory: options.includeMovement }),
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
  options: { forceMovement?: boolean; includeMovementGroup?: boolean } = {},
) {
  const [path, rawQuery = ''] = href.split('?')
  const params = new URLSearchParams(rawQuery)
  const filterParams = procurementFilterParams(filters, {
    includeGroupBy: true,
    includeMovement: options.forceMovement || (options.includeMovementGroup !== false && filters.groupBy === 'MovementCategory'),
  })
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return `${path}?${params.toString()}`
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
    headers: { 'x-sql-gateway-base': window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001' },
  })
  const data = await response.json().catch(() => ({})) as {
    success?: boolean
    data?: { summary?: DbRow }
  }
  if (!response.ok || data.success !== true || !data.data?.summary) {
    return { ok: false, summary: {} }
  }
  const summary = data.data.summary
  return {
    ok: true,
    summary,
    updatedAt: firstText(summary, ['TerakhirUpdate', 'LastMovementDate', 'LastUsageDate', 'LastRunningUpdate']),
  }
}

const DEFAULT_PROCUREMENT_KPI_FILTERS: ProcurementKpiFilters = {
  period: '', // filled at runtime via currentPeriod()
  movementWindow: 'all',
  groupBy: 'ProductTypeCode',
  scopeCode: '',
  itemType: '',
  location: '',
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
  const selectedGroup = analysisGroupOptions.find((option) => option.value === filters.groupBy) ?? analysisGroupOptions[0]
  const periods = periodOptions()
  const filteredLinks = {
    stock: hrefWithFilters(links.stock, filters, { includeMovementGroup: false }),
    receive: hrefWithFilters(links.receive, filters, { includeMovementGroup: false }),
    process: hrefWithFilters(links.process, filters, { includeMovementGroup: false }),
    workshop: hrefWithFilters(links.workshop, {
      ...filters,
      itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop',
    }, { includeMovementGroup: false }),
    movement: hrefWithFilters(links.movement, filters, { forceMovement: true }),
  }
  const updateFilter = <K extends keyof ProcurementKpiFilters>(key: K, value: ProcurementKpiFilters[K]) => {
    setFilters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'groupBy') next.scopeCode = ''
      return next
    })
  }
  const resetFilters = () => {
    setFilters(createDefaultProcurementKpiFilters())
  }

  useEffect(() => {
    const controller = new AbortController()
    const baseParams = procurementFilterParams(filters)
    startTransition(() => setState((current) => ({
      source,
      loading: true,
      snapshots: current.source === source ? current.snapshots : {},
    })))

    Promise.allSettled(kpiRequests.map(async (request) => {
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
            ...analysisScopeParams(filters, { includeMovementCategory: true }),
            groupBy: 'MovementCategory',
            chartDimension: 'MovementCategory',
            movementWindow: filters.movementWindow || 'all',
          }
        } else if (filters.groupBy === 'MovementCategory') {
          extra = {
            ...extra,
            movementWindow: filters.movementWindow || 'all',
          }
        }
        return [request.key, await fetchSummary(source, request.report, controller.signal, extra)] as const
      }))
      .then((results) => {
        if (controller.signal.aborted) return
        const snapshots: Partial<Record<KpiKey, Snapshot>> = {}
        results.forEach((result, index) => {
          const key = kpiRequests[index].key
          snapshots[key] = result.status === 'fulfilled'
            ? result.value[1]
            : { ok: false, summary: {} }
        })
        startTransition(() => setState({ source, loading: false, snapshots }))
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
  const receiveLines = firstNumber(receive, ['TotalBaris'])
  const receiveQty = firstNumber(receive, ['TotalQuantity'])
  const receiveAmount = firstNumber(receive, ['TotalAmount'])
  const receiveSupplier = firstNumber(receive, ['TotalSupplier'])
  const receiveItem = firstNumber(receive, ['TotalItem'])
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
  const regularMovement = firstNumber(movement, ['RegularStockIssueMovementCount'])
  const workshopMovement = firstNumber(movement, ['WorkshopStockIssueMovementCount'])
  const fastMovingItem = firstNumber(movement, ['FastMovingItem'])
  const movingItem = firstNumber(movement, ['MovingItem'])
  const slowMovingItem = firstNumber(movement, ['SlowMovingItem'])
  const deadMovementItem = firstNumber(movement, ['DeadMovementItem'])
  const staleItem = firstNumber(movement, ['StaleItem', 'NoMovementItem'])
  const riskMovementItem = slowMovingItem + deadMovementItem + staleItem
  const dataQualityAlert =
    firstNumber(stock, ['zero_quantity_item', 'ItemStokNol']) +
    firstNumber(stock, ['zero_unit_cost_item']) +
    firstNumber(receive, ['MissingPOLineCostRows']) +
    firstNumber(pr, ['OutstandingAmountNol'])

  const valuationCards: ProcurementKpiCard[] = [
    {
      id: 'stock',
      label: 'Total Valuasi Inventory',
      value: formatCurrency(inventoryValue),
      description: 'Nilai stock full-scope Procurement. Bukan Gudang saja.',
      formula: 'SUM((QtyOnHand + QtyOnHold) x AverageCost); ItemType 1 + 4.',
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
      description: 'Porsi valuasi ItemType 1.',
      formula: 'SUM(total_amount) WHERE ItemType = 1.',
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
      description: 'Porsi valuasi ItemType 4.',
      formula: 'SUM(total_amount) WHERE ItemType = 4.',
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
      description: 'Barang masuk supplier ke inventory.',
      formula: 'SUM(ReceiveQty x PO Cost).',
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
      description: 'Kebutuhan PR belum terpenuhi.',
      formula: 'SUM(IN_PRLN.QtyOutstanding).',
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
      description: 'PO belum diterima penuh.',
      formula: 'SUM(QtyOrder - QtyReceive).',
      source: 'purchase-order-history',
      breakdown: [
        { label: 'Total PO', value: formatNumber(poCount) },
        { label: 'Qty order', value: formatQuantity(poQtyOrder) },
        { label: 'Nilai PO', value: formatCurrency(poAmount) },
      ],
      href: filteredLinks.process,
      icon: CircleDollarSign,
      className: 'border-yellow-300/25 bg-yellow-400/10 text-yellow-100',
    },
  ]

  const movementCards: ProcurementKpiCard[] = [
    {
      id: 'movement-risk',
      label: 'Slow / Dead / Stale',
      value: formatNumber(riskMovementItem),
      description: 'Item perlu review movement.',
      formula: 'Slow + Dead + Stale dari MovementCategory periodik.',
      source: `all-stock-movement-analysis · MC ${filters.movementWindow}`,
      breakdown: [
        { label: 'Fast Moving', value: formatNumber(fastMovingItem) },
        { label: 'Moving', value: formatNumber(movingItem) },
        { label: 'Event movement', value: formatNumber(movementEvent) },
      ],
      href: filteredLinks.movement,
      icon: AlertTriangle,
      className: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
    },
    {
      id: 'data-quality',
      label: 'Quality Alert',
      value: formatNumber(dataQualityAlert),
      description: 'Sinyal data yang bikin KPI salah tafsir.',
      formula: 'Zero qty + zero cost + missing PO cost + PR amount 0.',
      source: 'valuation + receive + PR quality',
      breakdown: [
        { label: 'Zero qty item', value: formatNumber(firstNumber(stock, ['zero_quantity_item', 'ItemStokNol'])) },
        { label: 'Zero unit cost', value: formatNumber(firstNumber(stock, ['zero_unit_cost_item'])) },
        { label: 'Issue amount', value: formatCurrency(movementAmount) },
      ],
      href: filteredLinks.stock,
      icon: Gauge,
      className: 'border-red-300/25 bg-red-400/10 text-red-100',
    },
  ]

  const partial = Object.values(snapshots).some((snapshot) => snapshot && !snapshot.ok)
  const headlineCard = valuationCards[0]
  const valuationSideCards = valuationCards.slice(1)
  const gudangShare = Math.min(Math.max(percentOf(gudangValue, inventoryValue), 0), 100)
  const workshopShare = Math.min(Math.max(percentOf(workshopValue, inventoryValue), 0), 100)

  const renderCardGrid = (cards: ProcurementKpiCard[]) => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Link
            key={card.id}
            href={card.href}
            className="group relative min-h-[150px] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] p-3 transition hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.085]"
          >
            <span className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-white/10 blur-2xl transition group-hover:bg-[var(--rc-forest-primary)]/20" aria-hidden="true" />
            <span className="relative z-10 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{card.label}</span>
                <strong className="mt-1 block truncate text-[1.45rem] font-black leading-none tracking-[-0.06em] text-[var(--rc-text)]">
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
                <span key={item.label} className="max-w-full rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-bold text-[var(--rc-text-faint)]">
                  <span>{item.label}: </span>
                  <strong className="text-[var(--rc-text)]">{loading ? '...' : item.value}</strong>
                </span>
              ))}
            </span>
            <span className="relative z-10 mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] font-bold text-[var(--rc-text-faint)]">
              {loading ? 'Loading' : card.source}
              <ArrowRight size={13} className="text-[var(--rc-forest-accent)]" />
            </span>
          </Link>
        )
      })}
    </div>
  )

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[var(--rc-forest-border)] bg-[radial-gradient(circle_at_8%_0%,rgba(155,226,61,.18),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(41,199,200,.16),transparent_25%),linear-gradient(135deg,rgba(2,10,7,.94),rgba(7,25,17,.9)_46%,rgba(10,14,7,.92))] shadow-[0_26px_90px_rgba(0,0,0,.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,.08),transparent_18%,transparent_72%,rgba(155,226,61,.08))]" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-2 border-b border-[var(--rc-border)] bg-black/10 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--rc-forest-accent)]">Procurement command deck</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.05em] text-[var(--rc-text)] sm:text-2xl">KPI dikelompokkan per konteks.</h2>
          <p className="mt-1 max-w-4xl text-xs font-semibold leading-5 text-[var(--rc-text-muted)]">
            Valuasi stock · Proses PR/PO/receive · Movement risk/quality. Satu filter pusat, tidak ada KPI inventory terpisah di bawah.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--rc-forest-border-strong)] bg-[rgba(155,226,61,.08)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--rc-forest-accent)]">
          {loading ? 'Mengambil summary live' : partial ? 'Live sebagian, fallback aktif' : 'Live dari SQL Gateway'}
        </span>
      </div>

      <div className="relative z-10 border-b border-[var(--rc-border)] bg-[rgba(2,10,7,.42)] px-3 py-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_150px_190px_minmax(180px,1fr)_150px_140px_auto]">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Periode</span>
            <select
              value={filters.period}
              onChange={(event) => updateFilter('period', event.target.value)}
              className="h-10 rounded-xl border border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none focus:border-[var(--rc-forest-accent)]"
            >
              {periods.map((period) => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Movement</span>
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
              value={filters.scopeCode}
              onChange={(event) => updateFilter('scopeCode', event.target.value)}
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

        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--rc-text-faint)]">
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Period {filters.period}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Group {selectedGroup.label}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">MC {filters.movementWindow}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">{filters.itemType ? `Scope ${filters.itemType}` : 'Scope Inventory 1+4'}</span>
          {filters.scopeCode ? <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-lime-100">Code {filters.scopeCode}</span> : null}
          {filters.location ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">Lokasi {filters.location}</span> : null}
        </div>
      </div>

      <div className="relative z-10 grid gap-3 p-3 lg:grid-cols-[minmax(340px,.95fr)_minmax(0,1.55fr)]">
        {headlineCard ? (
          <Link
            href={headlineCard.href}
            className="group relative min-h-[222px] overflow-hidden rounded-[28px] border border-emerald-300/25 bg-[linear-gradient(145deg,rgba(24,185,107,.2),rgba(4,18,12,.72)_52%,rgba(214,184,92,.13))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)]"
          >
            <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl transition group-hover:bg-lime-300/25" aria-hidden="true" />
            <span className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-[linear-gradient(90deg,rgba(155,226,61,.14),transparent)]" aria-hidden="true" />

            <span className="relative z-10 flex items-start justify-between gap-3">
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-emerald-100/70">Master valuation</span>
                <strong className="mt-2 block text-[2.35rem] font-black leading-none tracking-[-0.08em] text-[var(--rc-text)] sm:text-5xl">
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
                <span>{loading ? '...' : `${formatCurrency(gudangValue)} · ${formatPercent(gudangShare)}`}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#18b96b,#9be23d)]" style={{ width: `${gudangShare}%` }} />
              </span>
              <span className="flex items-center justify-between gap-3 text-[11px] font-black text-amber-50/80">
                <span>Workshop/Mesin</span>
                <span>{loading ? '...' : `${formatCurrency(workshopValue)} · ${formatPercent(workshopShare)}`}</span>
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
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/70">1. Valuasi stock</p>
            {renderCardGrid(valuationSideCards)}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/70">2. Proses procurement</p>
            {renderCardGrid(processCards)}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-100/70">3. Movement + quality</p>
            {renderCardGrid(movementCards)}
          </div>
        </div>
      </div>
    </section>
  )
}
