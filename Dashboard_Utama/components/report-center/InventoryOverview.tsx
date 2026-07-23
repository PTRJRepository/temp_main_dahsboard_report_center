'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Database, RefreshCw, Search, TrendingUp } from 'lucide-react'
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
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(numeric)
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

  return (
    <section className={cx('rc-panel rc-panel-active overflow-hidden rounded-[30px] p-4 sm:p-5', className)} aria-label="Inventory analytics overview">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">Evidence · movement + exception</p>
              <h2 className="mt-1.5 text-xl font-black tracking-[-0.04em] text-[var(--rc-text)] sm:text-2xl">
                Movement mix after KPI deck
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--rc-text-muted)] sm:text-sm sm:leading-6">
                Full-scope API <code className="text-[var(--rc-forest-accent)]">{OVERVIEW_REPORT_ID}</code>
                {' '}· MovementCategory periodik · bukan preview rows. Valuasi/PR-PO KPI live di command deck.
              </p>
            </div>

            <div className={cx(
              'grid min-w-[280px] gap-2 rounded-2xl border p-3',
              hideScopeControls
                ? 'border-[var(--rc-forest-border)] bg-white/[0.03]'
                : 'border-2 border-amber-400/50 bg-[rgba(120,53,15,.28)] shadow-[0_0_0_1px_rgba(251,191,36,.25)]',
            )}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className={cx(
                    'text-[11px] font-black uppercase tracking-[0.16em]',
                    hideScopeControls ? 'text-[var(--rc-text-faint)]' : 'text-amber-200',
                  )}>
                    {hideScopeControls ? 'Threshold editor' : 'Period + Movement Category Window'}
                  </p>
                  {hideScopeControls ? (
                    <p className="mt-1 text-[11px] font-semibold text-[var(--rc-text-muted)]">{movementDefinitionLabel(movementDefinition)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="rc-forest-focus grid h-10 w-10 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-forest-accent)] hover:bg-white/10"
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
              <div className={cx('grid grid-cols-2 gap-2', hideScopeControls && 'opacity-90')}>
                <label className="grid gap-1">
                  <span className={cx('text-[10px] font-black uppercase tracking-[0.12em]', hideScopeControls ? 'text-[var(--rc-text-faint)]' : 'text-amber-100/80')}>Fast &gt;=</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.fastMin}
                    onChange={(event) => updateMovementDefinition('fastMin', event.target.value)}
                    className={cx(
                      'h-9 rounded-xl border px-3 text-sm font-black outline-none',
                      hideScopeControls
                        ? 'border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.82)] text-[var(--rc-text)]'
                        : 'border-amber-300/40 bg-[#1a1005] text-amber-50',
                    )}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={cx('text-[10px] font-black uppercase tracking-[0.12em]', hideScopeControls ? 'text-[var(--rc-text-faint)]' : 'text-amber-100/80')}>Slow =</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.slowCount}
                    onChange={(event) => updateMovementDefinition('slowCount', event.target.value)}
                    className={cx(
                      'h-9 rounded-xl border px-3 text-sm font-black outline-none',
                      hideScopeControls
                        ? 'border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.82)] text-[var(--rc-text)]'
                        : 'border-amber-300/40 bg-[#1a1005] text-amber-50',
                    )}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={cx('text-[10px] font-black uppercase tracking-[0.12em]', hideScopeControls ? 'text-[var(--rc-text-faint)]' : 'text-amber-100/80')}>Moving min</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.movingMin}
                    onChange={(event) => updateMovementDefinition('movingMin', event.target.value)}
                    className={cx(
                      'h-9 rounded-xl border px-3 text-sm font-black outline-none',
                      hideScopeControls
                        ? 'border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.82)] text-[var(--rc-text)]'
                        : 'border-amber-300/40 bg-[#1a1005] text-amber-50',
                    )}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={cx('text-[10px] font-black uppercase tracking-[0.12em]', hideScopeControls ? 'text-[var(--rc-text-faint)]' : 'text-amber-100/80')}>Moving max</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={movementDefinition.movingMax}
                    onChange={(event) => updateMovementDefinition('movingMax', event.target.value)}
                    className={cx(
                      'h-9 rounded-xl border px-3 text-sm font-black outline-none',
                      hideScopeControls
                        ? 'border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.82)] text-[var(--rc-text)]'
                        : 'border-amber-300/40 bg-[#1a1005] text-amber-50',
                    )}
                  />
                </label>
              </div>
              <div className={cx(
                'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold',
                hideScopeControls ? 'bg-black/20 text-[var(--rc-text-muted)]' : 'bg-black/20 text-amber-50/80',
              )}>
                <span>{movementDefinitionLabel(movementDefinition)}</span>
                <button
                  type="button"
                  onClick={() => setMovementDefinition(DEFAULT_MOVEMENT_DEFINITION)}
                  className={cx(
                    'rounded-lg border px-2 py-1 font-black hover:bg-white/10',
                    hideScopeControls
                      ? 'border-[var(--rc-forest-border)] text-[var(--rc-text-muted)]'
                      : 'border-amber-300/30 text-amber-100 hover:bg-amber-300/10',
                  )}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.035] px-3 py-2.5 text-[11px] font-semibold leading-5 text-[var(--rc-text-muted)] sm:grid-cols-2" aria-label="Evidence provenance">
            <span className="inline-flex items-start gap-2">
              <Database size={13} className="mt-0.5 shrink-0 text-[var(--rc-forest-accent)]" />
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Query</span>
                {OVERVIEW_REPORT_ID}
              </span>
            </span>
            <span className="inline-flex items-start gap-2">
              <CalendarDays size={13} className="mt-0.5 shrink-0 text-[var(--rc-forest-accent)]" />
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Scope</span>
                {sourceLabel(source)} · {period} · {itemTypeLabel(itemType)} · MC {movementWindow}
              </span>
            </span>
            <span className="sm:col-span-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Provenance</span>
              {sourceDescription(source)} · {movementDefinitionLabel(movementDefinition)} · {partial ? 'partial detail, full KPI' : 'full KPI scope'}
              {' · '}
              <span className={cx(
                error ? 'text-rose-100' : stale ? 'text-amber-100' : 'text-emerald-100',
              )}>
                {error ? 'API error, context retained' : stale ? 'Refreshing, previous retained' : generatedAt ? `Generated ${new Date(generatedAt).toLocaleTimeString('id-ID')}` : 'Ready'}
              </span>
              {empty ? ' · Empty movement scope' : ''}
            </span>
          </div>
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
