'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, CalendarDays, Database, Layers3, Package, RefreshCw, Search, TrendingUp, Wallet } from 'lucide-react'
import AnalyticsKpiStrip, { type AnalyticsKpiItem } from './AnalyticsKpiStrip'
import ExceptionQueue, { type InventoryExceptionItem } from './ExceptionQueue'
import MovementComposition, { movementTone, type MovementCompositionSegment } from './MovementComposition'

type ReportSource = 'estate' | 'pabrik'
type InventoryItemTypeScope = 'gudang' | 'workshop'
type DbRow = Record<string, unknown>

type ReportKpiEntry = {
  id: string
  label: string
  value: string | number | null
  unit?: string
  format?: string
  scope: string
}

type ReportBreakdownEntry = {
  id: string
  label: string
  dimensionId?: string
  value: string | number | null
  format?: string
  scope: string
  filterAction?: {
    semanticDimensionId?: string
    field?: string
    value?: string | number | boolean
  }
}

type ReportDetailWindow = {
  partial?: boolean
  totalRows?: number
  returnedRows?: number
  strategy?: string
}

type InventoryAnalytics = {
  kpis: ReportKpiEntry[]
  breakdowns: ReportBreakdownEntry[]
  detailWindow?: ReportDetailWindow
}

type InventoryOverviewPayload = {
  summary: DbRow
  chart: DbRow[]
  metadata: DbRow
  analytics?: InventoryAnalytics
}

type InventoryOverviewApiResponse = {
  success?: boolean
  data?: InventoryOverviewPayload
  error?: string
}

type MovementDefinition = {
  fastMin: number
  movingMin: number
  movingMax: number
  slowCount: number
}

type InventoryOverviewProps = {
  source: ReportSource
  className?: string
  /** Acc month YYYY-MM. Controlled when parent owns module filters. */
  period?: string
  onPeriodChange?: (value: string) => void
  movementWindow?: string
  onMovementWindowChange?: (value: string) => void
  itemType?: InventoryItemTypeScope
  /** Hide local period/MC controls when parent already shows global filter bar. */
  hideScopeControls?: boolean
}

const OVERVIEW_REPORT_ID = 'all-stock-movement-analysis'
const VALUATION_REPORT_ID = 'asset-stock-valuasi-listing'

const MOVEMENT_WINDOW_OPTIONS = [
  { value: 'all', label: 'All period' },
  { value: '1m', label: '1 bulan' },
  { value: '3m', label: '3 bulan' },
  { value: '6m', label: '6 bulan' },
  { value: '12m', label: '12 bulan' },
]

const MOVEMENT_CATEGORY_LABELS = [
  'Fast Moving',
  'Moving',
  'Slow Moving',
  'Dead Stock',
  'Stale',
] as const

const MOVEMENT_CATEGORY_LOOKUP = new Map(
  MOVEMENT_CATEGORY_LABELS.map((label) => [label.toLowerCase(), label]),
)

const MOVEMENT_SUMMARY_KEYS = [
  { label: 'Fast Moving', itemKey: 'FastMovingItem', amountKey: 'FastMovingAmount' },
  { label: 'Moving', itemKey: 'MovingItem', amountKey: 'MovingAmount' },
  { label: 'Slow Moving', itemKey: 'SlowMovingItem', amountKey: 'SlowMovingAmount' },
  { label: 'Dead Stock', itemKey: 'DeadMovementItem', amountKey: 'DeadMovementAmount' },
  { label: 'Stale', itemKey: 'StaleItem', amountKey: 'StaleAmount' },
] as const

const DEFAULT_MOVEMENT_DEFINITION: MovementDefinition = {
  fastMin: 6,
  movingMin: 2,
  movingMax: 5,
  slowCount: 1,
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function sourceLabel(source: ReportSource) {
  return source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun'
}

function sourceDescription(source: ReportSource) {
  return source === 'pabrik' ? 'SERVER_PROFILE_3 / db_ptrj_mill' : 'SERVER_PROFILE_2 / db_ptrj'
}

function itemTypeLabel(itemType?: InventoryItemTypeScope) {
  if (itemType === 'workshop') return 'Workshop / ItemType 4'
  if (itemType === 'gudang') return 'Gudang / ItemType 1'
  return 'Gudang + Workshop'
}

function movementDefinitionParams(definition: MovementDefinition) {
  return {
    movementFastMin: String(definition.fastMin),
    movementMovingMin: String(definition.movingMin),
    movementMovingMax: String(definition.movingMax),
    movementSlowCount: String(definition.slowCount),
  }
}

function movementDefinitionLabel(definition: MovementDefinition) {
  return `Fast >= ${definition.fastMin} · Moving ${definition.movingMin}-${definition.movingMax} · Slow = ${definition.slowCount}`
}

function normalizeMovementDefinitionValue(value: string, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(Math.trunc(numeric), 1), 999)
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

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

function formatMetric(value: unknown, format?: string) {
  const numeric = numberValue(value)
  if (format === 'currency') {
    if (Math.abs(numeric) >= 1_000_000_000) return `Rp${(numeric / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
    if (Math.abs(numeric) >= 1_000_000) return `Rp${(numeric / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}Jt`
    return `Rp${numeric.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
  }
  if (format === 'quantity') return numeric.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  return numeric.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function findKpi(payload: InventoryOverviewPayload | null, id: string) {
  return payload?.analytics?.kpis.find((kpi) => kpi.id === id)
}

function summaryNumber(payload: InventoryOverviewPayload | null, keys: string[]) {
  if (!payload) return undefined
  const key = keys.find((item) => payload.summary[item] !== undefined && payload.summary[item] !== null && payload.summary[item] !== '')
  return key ? payload.summary[key] : undefined
}

export function inventoryKpiValue(payload: InventoryOverviewPayload | null, id: string, summaryKeys: string[]) {
  const kpiValue = findKpi(payload, id)?.value
  if (kpiValue !== undefined && kpiValue !== null && kpiValue !== '') return kpiValue
  return summaryNumber(payload, summaryKeys)
}

function cleanMovementLabel(label: string) {
  return label.replace(/^Movement Category\s*-\s*/i, '').trim()
}

function normalizeMovementCategoryLabel(value: unknown) {
  const cleaned = cleanMovementLabel(String(value ?? ''))
    .replace(/^Movement\s*-\s*/i, '')
    .trim()
  if (!cleaned) return ''
  if (/^no movement$/i.test(cleaned)) return 'Stale'
  return MOVEMENT_CATEGORY_LOOKUP.get(cleaned.toLowerCase()) ?? ''
}

function breakdownValue(breakdown: ReportBreakdownEntry) {
  return numberValue(breakdown.value)
}

function summaryMovementBreakdowns(payload: InventoryOverviewPayload | null) {
  const summary = payload?.summary
  if (!summary) return []

  return MOVEMENT_SUMMARY_KEYS.flatMap((definition): ReportBreakdownEntry[] => {
    const itemCount = numberValue(summary[definition.itemKey])
    const amount = numberValue(summary[definition.amountKey])
    if (itemCount <= 0 && amount <= 0) return []
    return [
      {
        id: `summary:${definition.label}`,
        label: definition.label,
        dimensionId: 'movement-category',
        value: amount,
        format: 'currency',
        scope: 'full-scope',
        filterAction: {
          semanticDimensionId: 'movement-category',
          value: definition.label,
        },
      },
    ]
  })
}

export function inventoryMovementBreakdowns(payload: InventoryOverviewPayload | null) {
  const analyticsRows = payload?.analytics?.breakdowns.filter((breakdown) => {
    const dimension = breakdown.dimensionId?.toLowerCase() ?? ''
    return (dimension === 'movement-category' || /movement category/i.test(breakdown.label))
      && Boolean(normalizeMovementCategoryLabel(breakdown.filterAction?.value ?? breakdown.label))
  }) ?? []

  if (analyticsRows.length > 0) return analyticsRows

  const chartRows = payload?.chart
    .map((row, index): ReportBreakdownEntry | null => {
      const label = normalizeMovementCategoryLabel(row.MovementCategory ?? row.DimensionValue ?? row.Label)
      if (!label) return null
      return {
        id: `chart:${index}`,
        label,
        dimensionId: 'movement-category',
        value: numberValue(row.AssetAmountRealTime ?? row.Amount ?? row.TotalAmount),
        format: 'currency',
        scope: 'full-scope',
        filterAction: {
          semanticDimensionId: 'movement-category',
          value: label,
        },
      }
    })
    .filter((row): row is ReportBreakdownEntry => Boolean(row)) ?? []

  return chartRows.length ? chartRows : summaryMovementBreakdowns(payload)
}

function filterValueFromBreakdown(breakdown: ReportBreakdownEntry) {
  return String(breakdown.filterAction?.value ?? cleanMovementLabel(breakdown.label))
}

function buildReportUrl(
  source: ReportSource,
  period: string,
  itemType: InventoryItemTypeScope | undefined,
  params: Record<string, string | undefined> = {},
  reportId = OVERVIEW_REPORT_ID,
) {
  const query = new URLSearchParams({
    source,
    period,
  })
  if (itemType) query.set('itemType', itemType)
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  return `/report-center/inventory/${reportId}?${query.toString()}`
}

export function InventoryOverview({
  source,
  className,
  period: controlledPeriod,
  onPeriodChange,
  movementWindow: controlledMovementWindow,
  onMovementWindowChange,
  itemType,
  hideScopeControls = false,
}: InventoryOverviewProps) {
  const router = useRouter()
  const [localPeriod, setLocalPeriod] = useState(() => currentPeriod())
  const [localMovementWindow, setLocalMovementWindow] = useState('all')
  const [movementDefinition, setMovementDefinition] = useState<MovementDefinition>(DEFAULT_MOVEMENT_DEFINITION)
  const period = controlledPeriod ?? localPeriod
  const setPeriod = (value: string) => {
    if (onPeriodChange) onPeriodChange(value)
    else setLocalPeriod(value)
  }
  const movementWindow = controlledMovementWindow ?? localMovementWindow
  const setMovementWindow = (value: string) => {
    if (onMovementWindowChange) onMovementWindowChange(value)
    else setLocalMovementWindow(value)
  }
  const updateMovementDefinition = (key: keyof MovementDefinition, value: string) => {
    setMovementDefinition((current) => ({
      ...current,
      [key]: normalizeMovementDefinitionValue(value, DEFAULT_MOVEMENT_DEFINITION[key]),
    }))
  }
  const [payload, setPayload] = useState<InventoryOverviewPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const options = useMemo(() => periodOptions(), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const query = new URLSearchParams({
      report: OVERVIEW_REPORT_ID,
      source,
      period,
      pageSize: '25',
      limit: '25',
      movementWindow: movementWindow || 'all',
      groupBy: 'MovementCategory',
      ...movementDefinitionParams(movementDefinition),
    })
    if (itemType) query.set('itemType', itemType)

    const loadOverview = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/reports/inventory?${query.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-sql-gateway-base': window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001' },
        })
        const result = (await response.json()) as InventoryOverviewApiResponse
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? 'Overview inventory gagal dimuat.')
        }
        if (active) setPayload(result.data)
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Overview inventory gagal dimuat.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(loadOverview)

    return () => {
      active = false
      controller.abort()
    }
  }, [itemType, movementDefinition, movementWindow, period, refreshKey, source])

  const openReport = (params?: Record<string, string | undefined>, reportId = OVERVIEW_REPORT_ID) => {
    const movementParams = reportId === OVERVIEW_REPORT_ID
      ? {
          movementWindow: movementWindow || 'all',
          groupBy: 'MovementCategory',
          ...movementDefinitionParams(movementDefinition),
        }
      : {}
    router.push(buildReportUrl(source, period, itemType, {
      ...movementParams,
      ...params,
    }, reportId))
  }

  const movementRows = useMemo(() => inventoryMovementBreakdowns(payload), [payload])
  const movementTotal = movementRows.reduce((sum, row) => sum + breakdownValue(row), 0)
  const fastMovingItem = numberValue(inventoryKpiValue(payload, 'fast-moving-item', ['FastMovingItem']))
  const deadMovementItem = numberValue(inventoryKpiValue(payload, 'dead-movement-item', ['DeadMovementItem']))
  const movementSegments: MovementCompositionSegment[] = movementRows.slice(0, 6).map((breakdown) => {
    const label = cleanMovementLabel(breakdown.label)
    const value = breakdownValue(breakdown)
    return {
      id: breakdown.id,
      label,
      value,
      valueLabel: formatMetric(value, breakdown.format ?? 'currency'),
      share: movementTotal > 0 ? (value / movementTotal) * 100 : 0,
      scope: breakdown.scope || 'full-scope',
      tone: movementTone(label),
      onSelect: () => openReport({ movementCategory: filterValueFromBreakdown(breakdown) }),
    }
  })

  const exceptions: InventoryExceptionItem[] = movementRows
    .filter((breakdown) => /dead|stale|slow/i.test(breakdown.label))
    .sort((a, b) => breakdownValue(b) - breakdownValue(a))
    .slice(0, 4)
    .map((breakdown) => {
      const label = cleanMovementLabel(breakdown.label)
      const severity = /dead/i.test(label) ? 'critical' : /slow/i.test(label) ? 'warning' : 'watch'
      return {
        id: `exception:${breakdown.id}`,
        title: label,
        description: `Nilai ${label.toLowerCase()} pada scope ${breakdown.scope || 'full-scope'} perlu dibuka untuk item detail dan tindakan inventory.`,
        valueLabel: formatMetric(breakdown.value, breakdown.format ?? 'currency'),
        severity,
        scope: breakdown.scope || 'full-scope',
        onOpen: () => openReport({ movementCategory: filterValueFromBreakdown(breakdown) }),
      }
    })

  const detailWindow = payload?.analytics?.detailWindow
  const stale = loading && Boolean(payload)
  const partial = Boolean(detailWindow?.partial || payload?.metadata?.windowed)
  const empty = !loading && !error && Boolean(payload) && movementSegments.length === 0
  const generatedAt = String(payload?.metadata?.queryTiming && typeof payload.metadata.queryTiming === 'object'
    ? (payload.metadata.queryTiming as { generatedAt?: unknown }).generatedAt ?? ''
    : payload?.metadata?.generatedAt ?? '')

  const kpiItems: AnalyticsKpiItem[] = [
    {
      id: 'total-valuation',
      label: 'Total valuasi',
      value: loading && !payload ? null : formatMetric(inventoryKpiValue(payload, 'total-valuation', ['total_amount', 'TotalAssetAmount', 'TotalAmount', 'NilaiPersediaan', 'TotalAmountItem']), 'currency'),
      helper: `Full-scope stock value · ${itemTypeLabel(itemType)}`,
      status: 'success',
      icon: <Wallet size={16} />,
      loading: loading && !payload,
      onSelect: () => openReport(undefined, VALUATION_REPORT_ID),
    },
    {
      id: 'unique-item-count',
      label: 'Jumlah item',
      value: loading && !payload ? null : formatMetric(inventoryKpiValue(payload, 'unique-item-count', ['total_item', 'TotalItem', 'FilteredRows'])),
      helper: 'Bukan jumlah tile',
      status: 'info',
      icon: <Package size={16} />,
      loading: loading && !payload,
      onSelect: () => openReport(undefined, VALUATION_REPORT_ID),
    },
    {
      id: 'total-quantity',
      label: 'Total quantity',
      value: loading && !payload ? null : formatMetric(inventoryKpiValue(payload, 'total-quantity', ['total_quantity', 'TotalQty', 'TotalQuantityClosing', 'TotalStok']), 'quantity'),
      helper: 'Full-scope quantity',
      status: 'neutral',
      icon: <Layers3 size={16} />,
      loading: loading && !payload,
      onSelect: () => openReport(undefined, VALUATION_REPORT_ID),
    },
    {
      id: 'movement-event-count',
      label: 'Movement event',
      value: loading && !payload ? null : formatMetric(inventoryKpiValue(payload, 'movement-event-count', ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'])),
      helper: `${formatMetric(fastMovingItem)} fast · ${formatMetric(deadMovementItem)} dead · MC ${movementWindow || 'all'}`,
      status: 'warning',
      icon: <Activity size={16} />,
      loading: loading && !payload,
      onSelect: () => openReport({ groupBy: 'MovementCategory' }),
    },
  ]

  return (
    <section className={cx('rc-panel rc-panel-active overflow-hidden rounded-[30px] p-4 sm:p-5', className)} aria-label="Inventory analytics overview">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Procurement inventory overview</p>
              <h2 className="mt-2 text-3xl font-black leading-[0.96] tracking-[-0.06em] text-[var(--rc-text)] sm:text-5xl">
                Lihat keputusan inventory dulu, baru buka report.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--rc-text-muted)]">
                KPI dan movement mix diambil dari full-scope API `all-stock-movement-analysis` dengan grouping MovementCategory periodik, bukan dari lokasi atau rows preview.
              </p>
            </div>

            <div className="grid min-w-[300px] gap-2 rounded-2xl border-2 border-amber-400/50 bg-[rgba(120,53,15,.28)] p-3 shadow-[0_0_0_1px_rgba(251,191,36,.25)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
                    {hideScopeControls ? 'Scope dari filter modul' : 'Period + Movement Category Window'}
                  </p>
                  {hideScopeControls ? (
                    <p className="mt-1 text-xs font-semibold text-amber-50/80">{period} · MC {movementWindow}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="rc-forest-focus grid h-11 w-11 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-forest-accent)] hover:bg-white/10"
                  aria-label="Refresh inventory overview"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                </button>
              </div>
              {!hideScopeControls ? (
                <>
                  <select
                    id="inventory-overview-period"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className="rc-forest-focus h-11 rounded-xl border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.82)] px-3 text-sm font-black text-[var(--rc-text)]"
                  >
                    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-100" htmlFor="inventory-overview-mc-window">
                    Movement Category window
                  </label>
                  <select
                    id="inventory-overview-mc-window"
                    value={movementWindow}
                    onChange={(event) => setMovementWindow(event.target.value)}
                    className="h-12 rounded-xl border border-amber-300/50 bg-[#1a1005] px-3 text-sm font-black text-amber-50 outline-none ring-2 ring-amber-400/40"
                  >
                    {MOVEMENT_WINDOW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] font-semibold leading-5 text-amber-50/90">
                    All / 1 / 3 / 6 / 12 bulan untuk hitung Fast-Moving dll. Bukan valuasi stok. DB read-only.
                  </p>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/80">Fast &gt;=</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.fastMin}
                    onChange={(event) => updateMovementDefinition('fastMin', event.target.value)}
                    className="h-10 rounded-xl border border-amber-300/40 bg-[#1a1005] px-3 text-sm font-black text-amber-50 outline-none"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/80">Slow =</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.slowCount}
                    onChange={(event) => updateMovementDefinition('slowCount', event.target.value)}
                    className="h-10 rounded-xl border border-amber-300/40 bg-[#1a1005] px-3 text-sm font-black text-amber-50 outline-none"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/80">Moving min</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.movingMin}
                    onChange={(event) => updateMovementDefinition('movingMin', event.target.value)}
                    className="h-10 rounded-xl border border-amber-300/40 bg-[#1a1005] px-3 text-sm font-black text-amber-50 outline-none"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/80">Moving max</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.movingMax}
                    onChange={(event) => updateMovementDefinition('movingMax', event.target.value)}
                    className="h-10 rounded-xl border border-amber-300/40 bg-[#1a1005] px-3 text-sm font-black text-amber-50 outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 text-[11px] font-semibold text-amber-50/80">
                <span>{movementDefinitionLabel(movementDefinition)}</span>
                <button
                  type="button"
                  onClick={() => setMovementDefinition(DEFAULT_MOVEMENT_DEFINITION)}
                  className="rounded-lg border border-amber-300/30 px-2 py-1 font-black text-amber-100 hover:bg-amber-300/10"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs font-semibold text-amber-50/80">
                <Database size={14} />
                <span>{sourceDescription(source)}</span>
                <CalendarDays size={14} />
                <span>{period} · {itemTypeLabel(itemType)} · MC {movementWindow} · {movementDefinitionLabel(movementDefinition)} · {partial ? 'partial detail, full KPI' : 'full KPI scope'}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-black text-[var(--rc-text-muted)]">
              {sourceLabel(source)}
            </span>
            <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-black text-[var(--rc-text-muted)]">
              {period}
            </span>
            <span className={cx(
              'rounded-full border px-3 py-1.5 text-xs font-black',
              error ? 'border-rose-300/25 bg-rose-400/10 text-rose-100' : stale ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
            )}>
              {error ? 'API error, context retained' : stale ? 'Refreshing, previous data retained' : generatedAt ? `Generated ${new Date(generatedAt).toLocaleTimeString('id-ID')}` : 'Ready'}
            </span>
            {empty ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">Empty movement scope</span>
            ) : null}
          </div>

          <AnalyticsKpiStrip
            className="mt-4"
            title="Inventory KPI"
            description="Klik KPI untuk membuka report live dengan source dan period yang sama."
            items={kpiItems}
          />
        </div>

        <ExceptionQueue
          items={exceptions}
          loading={loading && !payload}
          error={error}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <MovementComposition segments={movementSegments} loading={loading && !payload} empty={empty} />
        <div className="rounded-[26px] border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Fast actions</p>
              <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--rc-text)]">Drill-down cepat</h3>
            </div>
            <TrendingUp size={20} className="text-[var(--rc-forest-accent)]" />
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ['Movement analysis', 'Buka semua item dengan movement category periodik.', undefined],
              ['Dead stock focus', 'Langsung filter Dead Stock untuk prioritas gudang.', 'Dead Stock'],
              ['Slow moving focus', 'Buka Slow Moving untuk review pembelian dan pemakaian.', 'Slow Moving'],
            ].map(([title, description, movementCategory]) => (
              <button
                key={title}
                type="button"
                onClick={() => openReport({ movementCategory })}
                className="rc-forest-focus grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-forest-accent)]">
                  <Search size={16} />
                </span>
                <span>
                  <span className="block text-sm font-black text-[var(--rc-text)]">{title}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--rc-text-faint)]">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default InventoryOverview
