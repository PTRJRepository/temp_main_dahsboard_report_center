'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Database, RefreshCw, Search, TrendingUp } from 'lucide-react'
import ExceptionQueue, { type InventoryExceptionItem } from './ExceptionQueue'
import FuelUsagePanel from './FuelUsagePanel'
import MicroReportHeader from './MicroReportHeader'
import MovementComposition, { movementTone, type MovementCompositionSegment } from './MovementComposition'
import MovementCategoryEvolution, {
  type CategoryEvolutionPoint,
  type MovementMover,
} from './MovementCategoryEvolution'
import MovementWindowTimeline, {
  lastDayOfMonthPeriod,
  type MovementWindowValue,
} from './MovementWindowTimeline'
import ProductTypeAnalysisPanel from './ProductTypeAnalysisPanel'
import ProductTypeDrilldown from './ProductTypeDrilldown'
import ReturnAnalysisPanel from './ReturnAnalysisPanel'
import UnusedStockPanel from './UnusedStockPanel'
import ValuationTreemap from './ValuationTreemap'
import MovementValuationTrend from './MovementValuationTrend'

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

type EvolutionApiResponse = {
  success: boolean
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  error?: string
}

function movementWindowToMonths(window: string): number {
  const map: Record<string, number> = {
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12,
    '2y': 24,
    '5y': 60,
    '10y': 120,
    all: 120,
  }
  return map[window] ?? 12
}

type InventoryOverviewProps = {
  source: ReportSource
  className?: string
  /** Acc month YYYY-MM. Controlled when parent owns module filters. */
  period?: string
  onPeriodChange?: (value: string) => void
  movementWindow?: string
  onMovementWindowChange?: (value: string) => void
  /** Rentang custom dari timeline (YYYY-MM-01 start / end) saat movementWindow='custom'. */
  movementWindowRange?: MovementWindowValue
  onMovementWindowRangeChange?: (value: MovementWindowValue) => void
  itemType?: InventoryItemTypeScope
  /** Hide local period/MC controls when parent already shows global filter bar. */
  hideScopeControls?: boolean
}

const OVERVIEW_REPORT_ID = 'all-stock-movement-analysis'

const MOVEMENT_WINDOW_OPTIONS = [
  { value: 'all', label: 'All period' },
  { value: '1m', label: '1 bulan' },
  { value: '3m', label: '3 bulan' },
  { value: '6m', label: '6 bulan' },
  { value: '12m', label: '12 bulan / 1 tahun' },
  { value: '2y', label: '2 tahun' },
  { value: '5y', label: '5 tahun' },
  { value: '10y', label: '10 tahun' },
  { value: 'custom', label: 'Custom range' },
]

function currentPeriod(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Bulan YYYY-MM N bulan sebelum anchor (inklusif mundur). */
function shiftMonthsBack(anchor: string, monthsBack: number) {
  const match = anchor.match(/^(\d{4})-(\d{2})$/)
  if (!match) return anchor
  const date = new Date(Number(match[1]), Number(match[2]) - 1 - monthsBack, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Nilai timeline (start/end YYYY-MM-01 atau null=all) untuk kombinasi
 * movementWindow + custom range. Hanya untuk tampilan slider.
 */
function timelineValueFromWindow(window: string, custom: MovementWindowValue, period: string): MovementWindowValue {
  if (window === 'custom') return custom
  if (window === 'all') return { start: null, end: null }
  const monthsMap: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12, '2y': 24, '5y': 60, '10y': 120 }
  const months = monthsMap[window] ?? 1
  return { start: `${shiftMonthsBack(period, months - 1)}-01`, end: `${period}-01` }
}

const MOVEMENT_CATEGORY_LABELS = [
  'Fast Moving',
  'Moving',
  'Slow Moving',
  'Dead Stock',
] as const

const MOVEMENT_CATEGORY_LOOKUP = new Map(
  MOVEMENT_CATEGORY_LABELS.map((label) => [label.toLowerCase(), label]),
)

const MOVEMENT_SUMMARY_KEYS = [
  { label: 'Fast Moving', itemKey: 'FastMovingItem', amountKey: 'FastMovingAmount' },
  { label: 'Moving', itemKey: 'MovingItem', amountKey: 'MovingAmount' },
  { label: 'Slow Moving', itemKey: 'SlowMovingItem', amountKey: 'SlowMovingAmount' },
  { label: 'Dead Stock', itemKey: 'DeadMovementItem', amountKey: 'DeadMovementAmount' },
] as const

/** Kandidat field summary untuk total valuasi resmi (fallback KPI inventory-total-valuation). */
const VALUATION_SUMMARY_KEYS = [
  'TotalAssetAmount',
  'TotalAmount',
  'total_amount',
  'NilaiPersediaan',
  'NilaiStok',
  'ClosingAmount',
]

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
  if (/^(no movement|stale)$/i.test(cleaned)) return 'Dead Stock'
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
  movementWindowRange: controlledMovementWindowRange,
  onMovementWindowRangeChange,
  itemType,
  hideScopeControls = false,
}: InventoryOverviewProps) {
  const router = useRouter()
  const [localPeriod, setLocalPeriod] = useState(() => currentPeriod())
  const [localMovementWindow, setLocalMovementWindow] = useState('all')
  const [localMovementWindowRange, setLocalMovementWindowRange] = useState<MovementWindowValue>({ start: null, end: null })
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
  const movementWindowRange = controlledMovementWindowRange ?? localMovementWindowRange
  const setMovementWindowRange = (value: MovementWindowValue) => {
    if (onMovementWindowRangeChange) onMovementWindowRangeChange(value)
    else setLocalMovementWindowRange(value)
  }
  const customWindowActive = movementWindow === 'custom'
  /** true begitu user menggeser timeline — timeline jadi sumber kebenaran dateFrom/dateTo,
   *  terlepas dari preset movementWindow (mengatasi preset 'all' yang mengabaikan timeline). */
  const [timelineTouched, setTimelineTouched] = useState(false)
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
  const [drillType, setDrillType] = useState<string | null>(null)
  const [evolutionPayload, setEvolutionPayload] = useState<EvolutionApiResponse | null>(null)
  const [evolutionLoading, setEvolutionLoading] = useState(false)
  const [evolutionMetric, setEvolutionMetric] = useState<'count' | 'qty' | 'amount'>('count')
  /** Mode perhitungan frekuensi: per bulan mandiri vs akumulasi to-date. */
  const [evolutionMode, setEvolutionMode] = useState<'monthly' | 'cumulative'>('monthly')
  /** Dimensi analisis evolusi: per item code vs per product type. */
  const [evolutionDimension, setEvolutionDimension] = useState<'item' | 'product-type'>('product-type')
  /** Top-N movers yang ditampilkan. */
  const [evolutionTopN, setEvolutionTopN] = useState(12)
  /** Jendela frekuensi (indeks ke periods) yang bisa digeser user; null = ikuti analysisPeriods penuh. */
  const [evolutionRange, setEvolutionRange] = useState<{ start: number; end: number } | null>(null)
  /** Periode analisis lain (trend) yang di-override manual; null = otomatis ikuti timeline. */
  const [manualAnalysisPeriods, setManualAnalysisPeriods] = useState<string[] | null>(null)
  const options = useMemo(() => periodOptions(), [])

  // Nilai timeline saat ini (preset atau custom) → range analisis trend.
  const timelineValue = useMemo(
    () => timelineValueFromWindow(movementWindow || 'all', movementWindowRange, period),
    [movementWindow, movementWindowRange, period],
  )
  const autoAnalysisPeriods = useMemo(() => {
    const start = timelineValue.start?.slice(0, 7)
    const end = timelineValue.end?.slice(0, 7)
    if (!start || !end) return []
    const list: string[] = []
    let [y, m] = start.split('-').map(Number)
    const [ey, em] = end.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      list.push(`${y}-${String(m).padStart(2, '0')}`)
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    return list
  }, [timelineValue])
  const analysisPeriods = manualAnalysisPeriods ?? autoAnalysisPeriods
  // Ganti preset window / periode → kembali ke mode preset (timeline belum disentuh)
  // dan lepas override analisis manual agar evolution tidak "nyangkut" di rentang lama.
  useEffect(() => {
    setTimelineTouched(false)
    setManualAnalysisPeriods(null)
  }, [movementWindow, period])
  // Jendela frekuensi efektif (geseran slider, else analysisPeriods penuh) — dipakai
  // sebagai dateFrom/dateTo BERSAMA oleh overview (Movement mix) DAN panel Evolusi,
  // supaya menggeser slider ikut mengubah valuasi tiap kategori di Movement mix.
  const effectiveAnalysisPeriods = useMemo(
    () => (evolutionRange ? analysisPeriods.slice(evolutionRange.start, evolutionRange.end + 1) : analysisPeriods),
    [analysisPeriods, evolutionRange],
  )
  const analysisMode: 'auto' | 'manual' = manualAnalysisPeriods == null ? 'auto' : 'manual'
  const analysisRangeLabel = analysisPeriods.length > 0
    ? `${analysisPeriods[0]} → ${analysisPeriods[analysisPeriods.length - 1]} · ${analysisPeriods.length} bulan · ${analysisMode === 'auto' ? 'otomatis' : 'manual'}`
    : 'Ikuti preset MC window'

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
    // Rentang eksplisit dari timeline: berlaku begitu timeline digeser (timeline = sumber
    // kebenaran), tidak lagi tergantung preset 'custom'. Fallback preset lama tetap jalan
    // bila timeline belum disentuh.
    const timelineActive = timelineTouched || movementWindow === 'custom'
    if (timelineActive && movementWindowRange.start && movementWindowRange.end) {
      query.set('dateFrom', movementWindowRange.start)
      query.set('dateTo', lastDayOfMonthPeriod(movementWindowRange.end.slice(0, 7)))
    } else if (effectiveAnalysisPeriods.length > 0) {
      // Timeline belum disentuh → ikuti jendela frekuensi efektif (slider / analysisPeriods),
      // sama seperti panel Evolusi, agar Movement mix ikut berubah saat slider digeser.
      query.set('dateFrom', effectiveAnalysisPeriods[0])
      query.set('dateTo', lastDayOfMonthPeriod(effectiveAnalysisPeriods[effectiveAnalysisPeriods.length - 1]))
    }

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
  }, [itemType, movementDefinition, movementWindow, movementWindowRange, timelineTouched, period, refreshKey, source, effectiveAnalysisPeriods])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const params = new URLSearchParams({
      source,
      period,
      movementFastMin: String(movementDefinition.fastMin),
      movementMovingMin: String(movementDefinition.movingMin),
      movementMovingMax: String(movementDefinition.movingMax),
      movementSlowCount: String(movementDefinition.slowCount),
    })
    // Mode akumulasi to-date → klasifikasi dari running total docs sejak awal jendela.
    if (evolutionMode === 'cumulative') params.set('accumulate', '1')
    // Dimensi analisis (item vs product type) + jumlah baris teratas.
    params.set('dimension', evolutionDimension)
    params.set('top', String(evolutionTopN))
    // Rentang eksplisit dari timeline (bila sudah digeser) = sumber kebenaran, sama seperti overview.
    const timelineActive = timelineTouched || movementWindow === 'custom'
    if (timelineActive && movementWindowRange.start && movementWindowRange.end) {
      params.set('dateFrom', movementWindowRange.start.slice(0, 7))
      params.set('dateTo', movementWindowRange.end.slice(0, 7))
    } else {
      // Jendela frekuensi efektif (sama dengan overview): geseran slider, else analysisPeriods penuh.
      // Trend (analisis lain) mengikuti periode analisis: auto=timeline, manual=range yang dipilih.
      if (effectiveAnalysisPeriods.length > 0) {
        params.set('dateFrom', effectiveAnalysisPeriods[0])
        params.set('dateTo', effectiveAnalysisPeriods[effectiveAnalysisPeriods.length - 1])
      } else {
        params.set('months', String(movementWindowToMonths(movementWindow || 'all')))
      }
    }
    if (itemType) params.set('itemType', itemType)

    const loadEvolution = async () => {
      setEvolutionLoading(true)
      try {
        const response = await fetch(`/api/reports/inventory/movement-category-evolution?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result = (await response.json()) as EvolutionApiResponse
        if (active && result?.success) setEvolutionPayload(result)
      } catch {
        // keep previous payload on error
      } finally {
        if (active) setEvolutionLoading(false)
      }
    }

    void loadEvolution()
    return () => {
      active = false
      controller.abort()
    }
  }, [source, period, movementWindow, movementWindowRange, timelineTouched, analysisPeriods, effectiveAnalysisPeriods, itemType, movementDefinition, evolutionMode, evolutionRange, evolutionDimension, evolutionTopN])

  const openReport = (params?: Record<string, string | undefined>, reportId = OVERVIEW_REPORT_ID) => {
    const movementParams = reportId === OVERVIEW_REPORT_ID
      ? {
          movementWindow: movementWindow || 'all',
          groupBy: 'MovementCategory',
          ...(customWindowActive && movementWindowRange.start && movementWindowRange.end
            ? {
                dateFrom: movementWindowRange.start,
                dateTo: lastDayOfMonthPeriod(movementWindowRange.end.slice(0, 7)),
              }
            : {}),
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
  // Total valuasi resmi = patokan "Total" di header Movement mix (bukan Σ segmen).
  const valuationTotal = numberValue(inventoryKpiValue(payload, 'inventory-total-valuation', VALUATION_SUMMARY_KEYS))
  // Inventory Return (IN_STOCKRTN + WS TT2) — info terpisah, TIDAK masuk kategori movement.
  const returnAmount = numberValue(
    payload?.summary?.ReturnAmount ?? payload?.summary?.return_amount ?? payload?.summary?.TotalReturnAmount,
  )
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
                {customWindowActive && movementWindowRange.start && movementWindowRange.end
                  ? ` (${movementWindowRange.start.slice(0, 7)} → ${movementWindowRange.end.slice(0, 7)})`
                  : ''}
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

          <MovementWindowTimeline
            className="mt-3"
            period={period}
            value={timelineValue}
            onChange={({ startMonth, endMonth }) => {
              setMovementWindowRange({ start: `${startMonth}-01`, end: `${endMonth}-01` })
              // Timeline digeser → jadi sumber kebenaran dateFrom/dateTo (overview + evolution).
              setTimelineTouched(true)
              if (!customWindowActive) setMovementWindow('custom')
              // Timeline berubah → analisis lain kembali ke mode otomatis (ikuti timeline).
              setManualAnalysisPeriods(null)
            }}
            analysisPeriods={analysisPeriods}
            analysisRangeLabel={analysisRangeLabel}
            analysisMode={analysisMode}
            onAnalysisPeriodsChange={(periods) => {
              // Mode auto → null (ikuti timeline); manual → simpan range timeline saat ini sbg dasar analisis.
              setManualAnalysisPeriods(periods.length > 0 ? null : autoAnalysisPeriods)
            }}
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
        <MovementComposition
          segments={movementSegments}
          loading={loading && !payload}
          empty={empty}
          valuationTotal={valuationTotal > 0 ? valuationTotal : undefined}
          segmentTotal={movementTotal > 0 ? movementTotal : undefined}
          returnInfo={returnAmount > 0 ? { amount: returnAmount } : undefined}
        />
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

      <div className="mt-5 h-[360px]">
        <MovementCategoryEvolution
          periods={evolutionPayload?.periods ?? []}
          byPeriod={evolutionPayload?.byPeriod ?? []}
          movers={evolutionPayload?.movers ?? []}
          totals={evolutionPayload?.totals ?? { qty: 0, amount: 0, docs: 0, itemCount: 0 }}
          metric={evolutionMetric}
          onMetricChange={setEvolutionMetric}
          mode={evolutionMode}
          onModeChange={(m) => {
            setEvolutionMode(m)
            // Ganti mode → kembali ke jendela penuh (reset geseran user).
            setEvolutionRange(null)
          }}
          dimension={evolutionDimension}
          onDimensionChange={setEvolutionDimension}
          topN={evolutionTopN}
          onTopNChange={setEvolutionTopN}
          range={evolutionRange ?? { start: 0, end: Math.max(0, (evolutionPayload?.periods.length ?? 1) - 1) }}
          onRangeChange={setEvolutionRange}
          loading={evolutionLoading}
        />
      </div>

      {/* Movement category × valuasi per bulan — tinggi bar = total issue (Rp) bulan itu. */}
      <div className="mt-5">
        <MovementValuationTrend
          periods={evolutionPayload?.periods ?? []}
          byPeriod={evolutionPayload?.byPeriod ?? []}
          loading={evolutionLoading}
        />
      </div>


      {/* Distribusi valuasi + Analisis per Product Type — drilldown KPI (Task 2) */}
      <div className="grid content-start gap-5 xl:grid-cols-2">
        <ValuationTreemap
          filters={{
            source,
            months: movementWindowToMonths(movementWindow || 'all'),
            itemType,
          }}
          onDrilldown={setDrillType}
        />
        <ProductTypeAnalysisPanel
          filters={{
            source,
            months: movementWindowToMonths(movementWindow || 'all'),
            itemType,
          }}
          onDrilldown={setDrillType}
        />
        {/* Fuel usage — item ke-3, melebar penuh di bawah dua kartu di atas. */}
        <div className="xl:col-span-2">
          <FuelUsagePanel
            filters={{
              source,
              months: movementWindowToMonths(movementWindow || 'all'),
              itemType,
            }}
          />
        </div>
        {/* Analisis return — purchasing vs inventory, melebar penuh di bawah fuel. */}
        <div className="xl:col-span-2">
          <ReturnAnalysisPanel
            filters={{
              source,
              months: movementWindowToMonths(movementWindow || 'all'),
              itemType,
            }}
          />
        </div>
        {/* Barang tidak terpakai — stok > 0 tanpa issue pada window, melebar penuh di bawah return. */}
        <div className="xl:col-span-2">
          <UnusedStockPanel
            filters={{
              source,
              months: movementWindowToMonths(movementWindow || 'all'),
              itemType,
            }}
          />
        </div>
      </div>
      {/* Analisis lain dari payload overview yang sama — ikut rentang timeline/mode analisis. */}
      <OtherAnalyses payload={payload} analysisRangeLabel={analysisRangeLabel} onOpen={(groupBy) => openReport({ groupBy })} />

      {/* Popup KPI per Product Type (Task 3) */}
      {drillType && (
        <ProductTypeDrilldown
          code={drillType}
          filters={{
                      source,
                      months: movementWindowToMonths(movementWindow || 'all'),
                      itemType,
                    }}
          onClose={() => setDrillType(null)}
        />
      )}
    </section>
  )
}

/** Breakdown + KPI tambahan (product type/category, lokasi, tipe item) yang ikut rentang analisis. */
function OtherAnalyses({
  payload,
  analysisRangeLabel,
  onOpen,
}: {
  payload: InventoryOverviewPayload | null
  analysisRangeLabel: string
  onOpen: (groupBy: string) => void
}) {
  const breakdowns = payload?.analytics?.breakdowns ?? []
  const byDimension = new Map<string, ReportBreakdownEntry[]>()
  for (const entry of breakdowns) {
    const key = entry.dimensionId ?? 'other'
    const list = byDimension.get(key) ?? []
    list.push(entry)
    byDimension.set(key, list)
  }
  const dimensions = [...byDimension.keys()].filter((d) => d !== 'movement-category')
  const kpis = payload?.analytics?.kpis ?? []
  const shownKpis = kpis.filter((k) => !/movement/i.test(k.id + k.label)).slice(0, 4)

  if (dimensions.length === 0 && shownKpis.length === 0) return null

  return (
    <div className="mt-5 rounded-[24px] border-[var(--rc-forest-border)] bg-[rgba(3,14,10,.4)] p-4" aria-label="Analisis lainnya">
      <div className="mb-3 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Analisis lainnya"
            title="Breakdown & KPI non-movement"
            subtitle="Ikut rentang analisis yang sama."
            accent="forest"
          />
        </div>
        <span className="rc-data rounded-full border-[var(--rc-forest-border)] bg-[var(--rc-forest-primary-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--rc-forest-accent)]">
          {analysisRangeLabel}
        </span>
      </div>

      {shownKpis.length > 0 ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {shownKpis.map((kpi) => (
            <div key={kpi.id} className="rounded-2xl border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{kpi.label}</p>
              <p className="mt-1 truncate text-sm font-black text-[var(--rc-text)]">{kpi.value ?? '—'}{kpi.unit ? ` ${kpi.unit}` : ''}</p>
            </div>
          ))}
        </div>
      ) : null}

      {dimensions.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dimensions.slice(0, 3).map((dimension) => {
            const rows = (byDimension.get(dimension) ?? []).slice(0, 5)
            const total = rows.reduce((sum, row) => sum + breakdownValue(row), 0)
            const groupBy = groupByForDimension(dimension)
            return (
              <div key={dimension} className="rounded-2xl border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--rc-text-muted)]">{dimensionLabel(dimension)}</p>
                  {groupBy ? (
                    <button
                      type="button"
                      onClick={() => onOpen(groupBy)}
                      className="text-[10px] font-black text-[var(--rc-forest-accent)] hover:underline"
                    >
                      Buka
                    </button>
                  ) : null}
                </div>
                <ul className="space-y-1.5">
                  {rows.map((row) => {
                    const value = breakdownValue(row)
                    const share = total > 0 ? (value / total) * 100 : 0
                    return (
                      <li key={row.id}>
                        <div className="mb-0.5 flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11px] font-semibold text-[var(--rc-text)]">{cleanMovementLabel(row.label)}</span>
                          <span className="rc-data shrink-0 text-[10px] font-bold text-[var(--rc-text-muted)]">{formatMetric(value, row.format ?? 'currency')}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-[var(--rc-forest-accent)]/70" style={{ width: `${Math.max(2, share)}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function dimensionLabel(dimension: string) {
  const map: Record<string, string> = {
    'item-code': 'Kode barang',
    'item-type': 'Tipe item',
    'product-type': 'Product type',
    'product-category': 'Product category',
    'product-brand': 'Product brand',
    'product-model': 'Product model',
    'product-material': 'Product material',
    'stock-analysis': 'Stock analysis',
    location: 'Lokasi',
  }
  return map[dimension] ?? dimension
}

function groupByForDimension(dimension: string): string | null {
  const map: Record<string, string> = {
    'product-type': 'ProductTypeCode',
    'product-category': 'ProductCategoryCode',
    'product-brand': 'ProductBrandCode',
    'product-model': 'ProductModelCode',
    'product-material': 'ProductMaterialCode',
    location: 'Location',
  }
  return map[dimension] ?? null
}

export default InventoryOverview
