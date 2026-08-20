'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import ReportControlBar from '@/components/report-center/ReportControlBar'
import type { ReportFilterInput } from '@/lib/reports/report-filtering'

type DbRow = Record<string, unknown>

export type ReportKpiCardLike = {
  label: string
  value: unknown
  description: string
  tone: string
  scope?: 'global' | 'flow' | 'breakdown' | 'sub' | 'movement'
  groupField?: string
  groupKey?: string
  flowSection?: string
  sourceTable?: string
  sourceField?: string
  metrics?: Array<{ key: string; label: string; value: unknown; sourceTable?: string; sourceField?: string }>
  simpleSql?: string
}

export type MonthlyStockRingkasanProps = {
  isMonthlyStockMovement: boolean
  stickyGrandTotals: Array<{ key: string; label: string; value: unknown }>
  kpiCards: ReportKpiCardLike[]
  flowKpiCards: ReportKpiCardLike[]
  globalKpiCards: ReportKpiCardLike[]
  breakdownKpiCards: ReportKpiCardLike[]
  subKpiCards: ReportKpiCardLike[]
  movementCategoryKpiCards: ReportKpiCardLike[]
  monthlySecondaryOpen: boolean
  setMonthlySecondaryOpen: (updater: (open: boolean) => boolean) => void
  resolvedMonthlyAnalysisGroup: string
  activeTableGroupColumn?: string
  activeMonthlyMovementWindow: string
  analysisGroupOptions: ReadonlyArray<{ field: string; label: string }>
  movementWindowOptions: ReadonlyArray<{ value: string; label: string }>
  requestFilters: ReportFilterInput
  payload: { summary?: DbRow; metadata?: DbRow; rows?: DbRow[]; columns?: Array<string | { field?: string; name?: string }> } | null
  appliedFilters: ReportFilterInput
  viewerProfile: { kpiPresetByLabel?: Record<string, string> }
  compactMetric: (value: unknown, field?: string, label?: string) => string
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (field: string) => string
  activePeriodLabels: { actual?: string; accounting?: string; summary: string }
  openKpiSqlDebug: (event: { preventDefault: () => void; stopPropagation: () => void }, kpi: ReportKpiCardLike) => void
  applyKpiFilter: (label: string) => void
  applySubKpiCardFilter: (kpi: ReportKpiCardLike) => void
  applyMonthlyAnalysisGroup: (groupBy: string) => void
  applyMonthlyMovementWindow: (window: string) => void
  applyMonthlyItemType?: (itemType: 'inventory' | 'gudang' | 'workshop') => void
  commitReportFilters: (filters: ReportFilterInput, message: string | null) => void
  setReportInfoVisible: (value: boolean) => void
  setReportInfoManuallyOpened: (value: boolean) => void
  setManualFilterOpen: (value: boolean) => void
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function metricValue(kpi: ReportKpiCardLike | undefined, pattern: RegExp) {
  const metric = kpi?.metrics?.find((item) => pattern.test(`${item.key} ${item.label}`))
  return metric?.value ?? kpi?.value ?? 0
}

function findKpi(cards: ReportKpiCardLike[], label: string) {
  return cards.find((card) => card.label.toLowerCase() === label.toLowerCase())
}

function flowSectionTone(section?: string) {
  if (section === 'opening') return 'border-sky-300/35 bg-sky-400/12 text-sky-50 shadow-[0_16px_48px_rgba(14,165,233,0.12)]'
  if (section === 'inventory') return 'border-lime-300/35 bg-lime-400/12 text-lime-50 shadow-[0_16px_48px_rgba(132,204,22,0.12)]'
  if (section === 'issued') return 'border-amber-300/40 bg-amber-400/14 text-amber-50 shadow-[0_16px_48px_rgba(245,158,11,0.16)]'
  if (section === 'purchasing') return 'border-cyan-300/35 bg-cyan-400/12 text-cyan-50 shadow-[0_16px_48px_rgba(34,211,238,0.12)]'
  if (section === 'closing') return 'border-yellow-200/45 bg-yellow-300/14 text-yellow-50 shadow-[0_18px_54px_rgba(250,204,21,0.18)]'
  return 'border-emerald-300/35 bg-emerald-400/12 text-emerald-50 shadow-[0_16px_48px_rgba(16,185,129,0.12)]'
}

function analysisGroupLabel(options: ReadonlyArray<{ field: string; label: string }>, value: string) {
  return options.find((option) => option.field === value)?.label ?? value
}

function SectionBar({
  title,
  note,
  tone = 'lime',
}: {
  title: string
  note?: string
  tone?: 'lime' | 'emerald' | 'amber' | 'sky'
}) {
  const toneClass = {
    lime: 'border-lime-300/35 bg-lime-300/10 text-lime-50 before:bg-lime-300',
    emerald: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-50 before:bg-emerald-300',
    amber: 'border-amber-300/35 bg-amber-300/10 text-amber-50 before:bg-amber-300',
    sky: 'border-sky-300/35 bg-sky-300/10 text-sky-50 before:bg-sky-300',
  }[tone]

  return (
    <div className={`relative flex flex-wrap items-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 ${toneClass}`}>
      <span className="text-sm font-black uppercase tracking-[0.18em] sm:text-base">{title}</span>
      {note && (
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
          {note}
        </span>
      )}
    </div>
  )
}

function firstMetric(kpi: ReportKpiCardLike, pattern: RegExp) {
  return kpi.metrics?.find((item) => pattern.test(`${item.key} ${item.label}`)) ?? kpi.metrics?.[0]
}

function cardChartValue(kpi: ReportKpiCardLike) {
  const metric = firstMetric(kpi, /ClosingAmount|AmountItem|IssuedTotalAmount|StockIssueMovementAmount|MovementIssueAmount|Amount|TotalItem|Count/i)
  return toNumber(metric?.value ?? kpi.value)
}

function KpiBarCard({
  kpi,
  max,
  compactMetric,
  label,
  caption,
  tone = 'sky',
  onClick,
}: {
  kpi: ReportKpiCardLike
  max: number
  compactMetric: (value: unknown, field?: string, label?: string) => string
  label: string
  caption?: string
  tone?: 'sky' | 'emerald'
  onClick?: () => void
}) {
  const headMetric = firstMetric(kpi, /ClosingAmount|AmountItem|IssuedTotalAmount|StockIssueMovementAmount|MovementIssueAmount|Amount|TotalItem|Count/i)
  const qtyMetric = firstMetric(kpi, /Qty|Quantity/i)
  const value = cardChartValue(kpi)
  const width = Math.max(5, Math.min(100, (Math.abs(value) / Math.max(max, 1)) * 100))
  const fill = tone === 'emerald' ? 'from-emerald-300 via-lime-300 to-yellow-200' : 'from-sky-300 via-cyan-300 to-lime-200'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border-2 border-white/10 bg-white/[0.055] p-4 text-left text-white shadow-[0_12px_42px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-1 hover:border-lime-300/45 hover:bg-white/[0.075] focus:outline-none focus:ring-2 focus:ring-lime-300/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1 truncate text-[11px] font-black uppercase tracking-[0.14em] text-white/60">
            {label}
            <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
          </span>
          <strong className="mt-1 block truncate text-lg font-black leading-tight text-white">{kpi.label}</strong>
        </div>
        <span className="shrink-0 rounded-2xl border border-lime-200/20 bg-lime-300/10 px-2.5 py-1 text-sm font-black tabular-nums text-lime-100">
          {compactMetric(value, headMetric?.key, kpi.label)}
        </span>
      </div>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-black/30 shadow-inner">
        <div className={`h-full rounded-full bg-gradient-to-r ${fill} shadow-[0_0_22px_rgba(190,242,100,0.28)]`} style={{ width: `${width}%` }} />
      </div>
      {caption && (
        <p className="mt-2 text-[11px] font-bold leading-4 text-white/55">{caption}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-bold text-white/60">
          {kpi.description}
        </span>
        {qtyMetric && (
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-100">
            Qty {compactMetric(qtyMetric.value, qtyMetric.key, qtyMetric.label)}
          </span>
        )}
      </div>
    </button>
  )
}

function MonthlyMovementVisuals({
  flowKpiCards,
  activeMonthlyMovementWindow,
  compactMetric,
  payload,
}: {
  flowKpiCards: ReportKpiCardLike[]
  activeMonthlyMovementWindow: string
  compactMetric: (value: unknown, field?: string, label?: string) => string
  payload: { summary?: DbRow; rows?: DbRow[] } | null
}) {
  const opening = findKpi(flowKpiCards, 'Opening')
  const issuedLedger = findKpi(flowKpiCards, 'Issued - Ledger')
  const issuedStation = findKpi(flowKpiCards, 'Issued - Station')
  const issuedVehicle = findKpi(flowKpiCards, 'Issued - Vehicle')
  const issuedTotal = findKpi(flowKpiCards, 'Issued - Total')
  const goodsReceive = findKpi(flowKpiCards, 'Purchasing - Goods Receive')
  const returnKpi = findKpi(flowKpiCards, 'Purchasing - Return')
  const closing = findKpi(flowKpiCards, 'Closing')

  const issueParts = [
    { label: 'Ledger', kpi: issuedLedger },
    { label: 'Station', kpi: issuedStation },
    { label: 'Vehicle', kpi: issuedVehicle },
  ].map((item) => ({ ...item, amount: toNumber(metricValue(item.kpi, /Amount/i)), qty: toNumber(metricValue(item.kpi, /Qty/i)) }))
  const issueTotalAmount = Math.max(toNumber(metricValue(issuedTotal, /Amount/i)), issueParts.reduce((sum, item) => sum + item.amount, 0), 1)

  const issueRows = (payload?.rows ?? []).filter((row) => toNumber(row.IssuedTotalAmount) > 0)
  const issueTotalFromRows = issueRows.reduce((sum, row) => sum + toNumber(row.IssuedTotalAmount), 0)
  const topIssueItems = [...issueRows]
    .sort((a, b) => toNumber(b.IssuedTotalAmount) - toNumber(a.IssuedTotalAmount))
    .slice(0, 5)
    .map((row) => ({
      code: String(row.StockCode ?? row.ItemCode ?? row.Code ?? row.StockName ?? row.ItemName ?? 'Item'),
      name: String(row.StockName ?? row.ItemName ?? row.Description ?? row.Name ?? ''),
      amount: toNumber(row.IssuedTotalAmount),
      qty: toNumber(row.IssuedTotalQty),
    }))
  const top5Amount = topIssueItems.reduce((sum, item) => sum + item.amount, 0)
  const concentrationShare = issueTotalFromRows > 0 ? Math.round((top5Amount / issueTotalFromRows) * 100) : 0
  const openingAmount = toNumber(metricValue(opening, /Amount/i))
  const closingAmount = toNumber(metricValue(closing, /Amount/i))
  const issuedAmountForHealth = toNumber(metricValue(issuedTotal, /Amount/i))
  const stockCoverage = issuedAmountForHealth > 0 ? closingAmount / issuedAmountForHealth : 0
  const openingToClosingDrop = openingAmount > 0 ? Math.round(((openingAmount - closingAmount) / openingAmount) * 100) : 0

  const bridge = [
    { label: 'Opening', kpi: opening, note: 'Saldo awal periode' },
    { label: 'Issued', kpi: issuedTotal, note: 'Total pemakaian keluar' },
    { label: 'Receive', kpi: goodsReceive, note: 'Barang masuk dari pembelian' },
    { label: 'Return', kpi: returnKpi, note: 'Retur ke supplier' },
    { label: 'Closing', kpi: closing, note: 'Saldo akhir periode' },
  ].map((item) => ({ ...item, amount: toNumber(metricValue(item.kpi, /Amount|TotalItem/i)), qty: toNumber(metricValue(item.kpi, /Qty/i)) }))
  const bridgeMax = Math.max(...bridge.map((item) => Math.abs(item.amount)), 1)

  return (
    <section className="overflow-hidden rounded-[28px] border-white/10 bg-white/[0.035] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-white/55">Alur periode</p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">Opening → issue → receive → closing</h3>
        </div>
        <span className="rounded-full border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
          Window {activeMonthlyMovementWindow}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {bridge.map((item) => {
          const width = Math.max(6, Math.min(100, (Math.abs(item.amount) / bridgeMax) * 100))
          return (
            <div key={item.label} className="rounded-2xl border-white/10 bg-black/25 p-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/55">{item.label}</span>
              <strong className="mt-1.5 block min-h-[2rem] text-lg font-black tabular-nums leading-tight text-white">
                {compactMetric(item.amount, 'Amount', item.label)}
              </strong>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white/45" style={{ width: `${width}%` }} />
              </div>
              <span className="mt-2 block text-[11px] font-semibold text-white/60">{item.note}</span>
              <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-white/45">Qty {compactMetric(item.qty, 'Qty', item.label)}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-2xl border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Rincian issue</p>
          <p className="text-[11px] font-bold text-white/50">Total {compactMetric(issueTotalAmount, 'IssuedTotalAmount', 'Issued total')}</p>
        </div>
        <div className="mt-3 space-y-2.5">
          {issueParts.map((item) => {
            const share = Math.round((item.amount / issueTotalAmount) * 100)
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-bold text-white/75">{item.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/45" style={{ width: `${Math.max(3, share)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-black tabular-nums text-white">{compactMetric(item.amount, 'IssuedTotalAmount', item.label)}</span>
                <span className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums text-white/50">{share}%</span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] font-semibold leading-4 text-white/50">
          Ledger = issue ke blok/afdeling, Station = issue ke stasiun pabrik, Vehicle = issue ke kendaraan. Persen = porsi dari total issue periode ini.
        </p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Konsentrasi issue per barang</p>
            <p className="text-[11px] font-bold text-white/50">
              Top 5 = {concentrationShare}% dari total issue · {issueRows.length} barang ada issue
            </p>
          </div>
          {topIssueItems.length > 0 ? (
            <div className="mt-3 space-y-2">
              {topIssueItems.map((item, index) => {
                const share = issueTotalFromRows > 0 ? Math.round((item.amount / issueTotalFromRows) * 100) : 0
                return (
                  <div key={`${item.code}-${index}`} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-[10px] font-black tabular-nums text-white/40">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-bold text-white/85">{item.code}{item.name ? ` · ${item.name}` : ''}</span>
                        <span className="shrink-0 text-xs font-black tabular-nums text-white">{compactMetric(item.amount, 'IssuedTotalAmount', item.code)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-white/45" style={{ width: `${Math.max(3, share)}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/50">{share}%</span>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/45">Qty {compactMetric(item.qty, 'IssuedTotalQty', item.code)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-white/50">Belum ada baris issue pada periode ini.</p>
          )}
          <p className="mt-3 text-[11px] font-semibold leading-4 text-white/50">
            Semakin besar porsi top 5, semakin tergantung pemakaian pada sedikit barang — prioritas kontrol stoknya.
          </p>
        </div>

        <div className="rounded-2xl border-white/10 bg-black/25 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Sehat arus stok</p>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-white/75">Coverage closing vs issue</span>
              <span className="text-sm font-black tabular-nums text-white">{stockCoverage.toFixed(2)}×</span>
            </div>
            <p className="text-[11px] font-semibold leading-4 text-white/50">
              {stockCoverage >= 2
                ? 'Stok akhir jauh di atas pemakaian — aman, tapi cek risiko overstock.'
                : stockCoverage >= 1
                  ? 'Stok akhir masih menutup pemakaian periode ini.'
                  : 'Stok akhir lebih kecil dari pemakaian — waspada kekurangan stok.'}
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-white/75">Opening → closing</span>
              <span className="text-sm font-black tabular-nums text-white">
                {openingToClosingDrop > 0 ? `-${openingToClosingDrop}%` : openingToClosingDrop < 0 ? `+${Math.abs(openingToClosingDrop)}%` : '0%'}
              </span>
            </div>
            <p className="text-[11px] font-semibold leading-4 text-white/50">
              {openingToClosingDrop > 0
                ? 'Nilai stok turun dari awal ke akhir periode — pemakaian melebihi pengisian.'
                : openingToClosingDrop < 0
                  ? 'Nilai stok naik dari awal ke akhir periode — pengisian melebihi pemakaian.'
                  : 'Nilai stok stabil dari awal ke akhir periode.'}
            </p>
          </div>
        </div>
      </div>

    </section>
  )
}

export function MonthlyStockRingkasan(props: MonthlyStockRingkasanProps) {
  const {
    isMonthlyStockMovement,
    stickyGrandTotals,
    kpiCards,
    flowKpiCards,
    globalKpiCards,
    breakdownKpiCards,
    subKpiCards,
    movementCategoryKpiCards,
    monthlySecondaryOpen,
    setMonthlySecondaryOpen,
    resolvedMonthlyAnalysisGroup,
    activeTableGroupColumn,
    activeMonthlyMovementWindow,
    analysisGroupOptions,
    movementWindowOptions,
    requestFilters,
    payload,
    appliedFilters,
    viewerProfile,
    compactMetric,
    formatValue,
    displayColumnLabel,
    activePeriodLabels,
    openKpiSqlDebug,
    applyKpiFilter,
    applySubKpiCardFilter,
    applyMonthlyAnalysisGroup,
    applyMonthlyMovementWindow,
    applyMonthlyItemType,
    commitReportFilters,
    setReportInfoVisible,
    setReportInfoManuallyOpened,
    setManualFilterOpen,
  } = props

  const MONTHLY_ANALYSIS_GROUP_OPTIONS = analysisGroupOptions
  const MONTHLY_MOVEMENT_WINDOW_OPTIONS = movementWindowOptions
  const activeAnalysisLabel = analysisGroupLabel(MONTHLY_ANALYSIS_GROUP_OPTIONS, resolvedMonthlyAnalysisGroup)
  const movementCategoryMax = Math.max(...movementCategoryKpiCards.map(cardChartValue), 1)

  return (
        <div className="rc-ringkasan sticky top-0 z-30 mt-5 space-y-5 rounded-[34px] border border-lime-300/25 bg-[var(--rc-surface-muted)]/97 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.50),0_0_0_1px_rgba(255,255,255,0.06),0_0_120px_rgba(132,204,22,0.08)] backdrop-blur-xl sm:p-5">
          {/* Hide sticky grand strip when official flow cards already carry open→close story (avoids double totals). */}
          {stickyGrandTotals.length > 0 && !(isMonthlyStockMovement && flowKpiCards.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-1 pb-2.5">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-lime-300/80">Ringkasan cepat</span>
              {stickyGrandTotals.slice(0, 6).map((item) => (
                <div
                  key={item.key}
                  className="inline-flex max-w-full items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/10 px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                  title={String(item.label)}
                >
                  <span className="rc-kpi-label truncate text-[10px] font-bold uppercase tracking-wide text-lime-200/70">{item.label}</span>
                  <span className="rc-kpi-value text-sm font-black text-lime-100">{compactMetric(item.value, item.key, item.label)}</span>
                </div>
              ))}
            </div>
          )}
          {isMonthlyStockMovement && (
            <section className="relative overflow-hidden rounded-[30px] border border-emerald-300/25 bg-[radial-gradient(circle_at_14%_0%,rgba(250,204,21,0.20),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,rgba(6,38,25,0.94),rgba(6,20,37,0.92))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-5">
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-yellow-200/20 bg-yellow-300/10 blur-3xl" aria-hidden="true" />
              <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 rounded-full border border-yellow-200/35 bg-yellow-300/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-yellow-50">
                    Palm estate movement detail
                  </p>
                  <h2 className="mt-3 max-w-5xl text-3xl font-black leading-[0.98] tracking-[-0.06em] text-white sm:text-5xl">
                    RPTIN1000015 Movement Estate View
                  </h2>
                  <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-emerald-50/72">
                    Opening, issue, purchasing, quantity, dan closing dibuat tebal supaya mutasi stok kebun sawit mudah dibaca cepat.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
                  <div className="rounded-2xl border border-emerald-200/25 bg-emerald-300/10 p-3">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Actual</span>
                    <strong className="mt-1 block text-base font-black text-emerald-50">{activePeriodLabels.actual ?? 'Current'}</strong>
                  </div>
                  <div className="rounded-2xl border border-amber-200/25 bg-amber-300/10 p-3">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/70">Accounting</span>
                    <strong className="mt-1 block text-base font-black text-amber-50">{activePeriodLabels.accounting ?? 'Auto'}</strong>
                  </div>
                  <div className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 p-3">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Analysis</span>
                    <strong className="mt-1 block truncate text-base font-black text-cyan-50">{activeAnalysisLabel}</strong>
                  </div>
                </div>
              </div>
            </section>
          )}
          {isMonthlyStockMovement && (
            <>
              <ReportControlBar
                periodValue={String(requestFilters.period ?? payload?.metadata?.actualPeriod ?? '')}
                analysisGroupValue={resolvedMonthlyAnalysisGroup}
                movementWindowValue={activeMonthlyMovementWindow}
                itemTypeValue={
                  requestFilters.itemType === 'gudang' || requestFilters.itemType === '1'
                    ? 'gudang'
                    : requestFilters.itemType === 'workshop' || requestFilters.itemType === '4'
                      ? 'workshop'
                      : 'inventory'
                }
                analysisGroupOptions={MONTHLY_ANALYSIS_GROUP_OPTIONS}
                movementWindowOptions={MONTHLY_MOVEMENT_WINDOW_OPTIONS}
                appliedFilters={appliedFilters}
                onPeriodChange={(period) => {
                  commitReportFilters({
                    ...appliedFilters,
                    period,
                    accYear: undefined,
                    accMonth: undefined,
                    actualYear: undefined,
                    actualMonth: undefined,
                  }, period ? `Actual period ${period} diterapkan dari KPI card rail.` : 'Current period diterapkan dari KPI card rail.')
                }}
                onAnalysisGroupChange={applyMonthlyAnalysisGroup}
                onMovementWindowChange={applyMonthlyMovementWindow}
                onItemTypeChange={(itemType) => {
                  if (applyMonthlyItemType) {
                    applyMonthlyItemType(itemType)
                    return
                  }
                  const nextItemType = itemType === 'inventory' ? undefined : itemType
                  commitReportFilters({
                    ...appliedFilters,
                    itemType: nextItemType,
                    includeWorkshopItem: itemType === 'gudang' ? 'no' : itemType === 'workshop' ? 'yes' : undefined,
                  }, itemType === 'inventory'
                    ? 'Item type: Gudang + Workshop (1+4).'
                    : itemType === 'gudang'
                      ? 'Item type: Gudang only (1).'
                      : 'Item type: Workshop only (4).')
                }}
                onMoreFilters={() => {
                  setReportInfoVisible(true)
                  setReportInfoManuallyOpened(true)
                  setManualFilterOpen(true)
                }}
              />
              <div className="grid gap-3 border-b border-white/10 px-1 pb-3 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/12 px-4 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/75">Actual month aktif</span>
                  <span className="mt-1 block text-lg font-black tabular-nums text-emerald-50">{activePeriodLabels.actual ?? 'Current'}</span>
                </div>
                <div className="rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/75">Acc month aktif</span>
                  <span className="mt-1 block text-lg font-black tabular-nums text-amber-50">{activePeriodLabels.accounting ?? 'Auto dari server'}</span>
                </div>
                <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/12 px-4 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/75">Kategori analisis</span>
                  <span className="mt-1 block truncate text-lg font-black text-cyan-50">{activeAnalysisLabel}</span>
                </div>
              </div>
              {flowKpiCards.length > 0 && (
                <MonthlyMovementVisuals
                  flowKpiCards={flowKpiCards}
                  activeMonthlyMovementWindow={activeMonthlyMovementWindow}
                  compactMetric={compactMetric}
                  payload={payload}
                />
              )}
              <section className="rounded-[30px] border border-emerald-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(132,204,22,0.20),transparent_30%),linear-gradient(135deg,rgba(5,40,25,0.94),rgba(4,24,20,0.92))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.10)] sm:p-5">
                <SectionBar
                  title="Movement category analysis"
                  note={`${movementCategoryKpiCards.length} kategori · window ${activeMonthlyMovementWindow} · Actual ${activePeriodLabels.actual ?? 'current'}`}
                  tone="emerald"
                />
                {movementCategoryKpiCards.length > 0 ? (
                  <div className="rc-breakdown-scroll mt-4 grid max-h-[38rem] grid-cols-1 gap-3 pr-1 lg:grid-cols-2 2xl:grid-cols-3">
                    {movementCategoryKpiCards.slice(0, 24).map((kpi) => (
                      <div key={`mc-chart-${kpi.groupField}-${kpi.groupKey}`} className="relative">
                        <button
                          type="button"
                          onClick={(event) => openKpiSqlDebug(event, kpi)}
                          title="SQL sederhana KPI ini"
                          className="rc-sql-debug absolute right-4 top-4 z-10 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 opacity-0 transition-all hover:bg-white/10 hover:text-white/80 focus-visible:opacity-100"
                        >
                          SQL
                        </button>
                        <KpiBarCard
                          kpi={kpi}
                          max={movementCategoryMax}
                          compactMetric={compactMetric}
                          label={`Movement · ${activeMonthlyMovementWindow}`}
                          caption="Bar length = issue movement metric for active movement window."
                          tone="emerald"
                          onClick={() => applySubKpiCardFilter(kpi)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-emerald-300/20 bg-black/20 p-5 text-sm font-semibold text-emerald-50/70">
                    Movement Category kosong untuk periode/window ini. Panel tetap tampil supaya sinkronisasi periode terlihat.
                  </div>
                )}
              </section>
            </>
          )}
          {kpiCards.length > 0 && (
            <div className="space-y-2">
              {flowKpiCards.length > 0 && (
                <div className="space-y-4">
                  <SectionBar
                    title="Ringkasan"
                    note={isMonthlyStockMovement
                      ? '14 kolom resmi PDF · Opening → Inventory → Issued → Purchasing → Closing · server filtered'
                      : 'Alur stok'}
                    tone="lime"
                  />
                  {(isMonthlyStockMovement
                    ? [
                        { id: 'opening', title: 'Opening', sections: ['opening'] },
                        { id: 'inventory', title: 'Inventory', sections: ['inventory'] },
                        { id: 'issued', title: 'Issued', sections: ['issued'] },
                        { id: 'purchasing', title: 'Purchasing', sections: ['purchasing'] },
                        { id: 'closing', title: 'Closing / Count', sections: ['closing', 'count'] },
                      ]
                    : [{ id: 'all', title: 'Alur stok', sections: ['opening', 'inventory', 'issued', 'purchasing', 'return', 'closing', 'count'] }]
                  ).map((group) => {
                    const sectionSet = new Set(group.sections)
                    const cards = flowKpiCards.filter((kpi) => sectionSet.has(kpi.flowSection ?? 'opening'))
                    if (cards.length === 0) return null
                    return (
                      <div key={group.id} className="space-y-3">
                        {isMonthlyStockMovement && (
                          <SectionBar
                            title={group.title}
                            note={group.id === 'issued' ? 'amount + qty split' : group.id === 'closing' ? 'saldo akhir + jumlah item' : undefined}
                            tone={group.id === 'issued' || group.id === 'purchasing' ? 'amber' : group.id === 'inventory' ? 'emerald' : group.id === 'opening' ? 'sky' : 'lime'}
                          />
                        )}
                        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isMonthlyStockMovement ? 'lg:grid-cols-2 2xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
                          {cards.map((kpi) => {
                            const amountMetric = (kpi.metrics ?? []).find((m) => /Amount|TotalItem/i.test(m.key)) ?? kpi.metrics?.[0]
                            const qtyMetric = (kpi.metrics ?? []).find((m) => /Qty/i.test(m.key))
                            const nested = !isMonthlyStockMovement
                              ? (kpi.metrics ?? []).filter((m) => m.key !== 'IssuedTotalAmount' && m.key !== 'TotalItem')
                              : []
                            return (
                              <div
                                key={`flow-${kpi.sourceField ?? kpi.label}`}
                                className={`rc-kpi-surface group relative min-h-[120px] rounded-2xl border-2 p-4 pr-12 text-left text-white shadow-[0_8px_32px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] ${kpi.tone}`}
                                title={[kpi.sourceTable, kpi.sourceField].filter(Boolean).join(' · ')}
                              >
                                <button
                                  type="button"
                                  onClick={(event) => openKpiSqlDebug(event, kpi)}
                                  title="SQL sederhana KPI ini"
                                  className="rc-sql-debug absolute right-3 top-3 z-10 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 hover:text-white/80"
                                >
                                  SQL
                                </button>
                                <span className="rc-kpi-label block truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                                  {kpi.label}
                                </span>
                                <span className="rc-kpi-value rc-metric mt-2 block text-3xl font-black tracking-tight text-lime-100 whitespace-normal break-all leading-tight">
                                  {compactMetric(kpi.value, amountMetric?.key ?? kpi.sourceField, kpi.label)}
                                </span>
                                {isMonthlyStockMovement && qtyMetric && kpi.sourceField !== 'TotalItem' ? (
                                  <>
                                    <span className="mt-2 block text-[12px] font-bold tabular-nums text-white/70">
                                      Qty {compactMetric(qtyMetric.value, qtyMetric.key, qtyMetric.label)}
                                    </span>
                                    <span className="mt-1 block text-[11px] font-semibold leading-snug text-white/55">
                                      {kpi.description}
                                    </span>
                                  </>
                                ) : (
                                  <span className="mt-1 block text-[12px] font-semibold leading-snug text-white/55">
                                    {kpi.description}
                                  </span>
                                )}
                                {nested.length > 0 && (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    {nested.slice(0, 4).map((metric) => (
                                      <div
                                        key={metric.key}
                                        className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 shadow-inner"
                                        title={`${metric.label}: ${formatValue(metric.value, metric.key)}`}
                                      >
                                        <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">
                                          {metric.label}
                                        </span>
                                        <span className="block text-[12px] font-black text-white/90 whitespace-normal break-all leading-tight">
                                          {compactMetric(metric.value, metric.key, metric.label)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Secondary rails: open by default for non-monthly; monthly keeps collapsed to cut noise. */}
              {isMonthlyStockMovement && (globalKpiCards.length > 0 || breakdownKpiCards.length > 0 || subKpiCards.length > 0 || movementCategoryKpiCards.length > 0) && (
                <div className="border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setMonthlySecondaryOpen((open) => !open)}
                    className="group flex w-full flex-col gap-3 rounded-[26px] border border-yellow-200/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.16),rgba(16,185,129,0.10),rgba(14,165,233,0.08))] p-4 text-left text-white shadow-[0_16px_56px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:border-lime-200/45 hover:bg-yellow-300/18 focus:outline-none focus:ring-2 focus:ring-lime-300/50 sm:flex-row sm:items-center sm:justify-between"
                    aria-expanded={monthlySecondaryOpen}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-yellow-100/25 bg-yellow-300/15 text-yellow-50 shadow-[0_0_24px_rgba(250,204,21,0.18)]">
                        {monthlySecondaryOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black uppercase tracking-[0.14em] text-yellow-50 sm:text-lg">
                          {monthlySecondaryOpen ? 'Sembunyikan analisis lanjutan' : 'Tampilkan analisis lanjutan'}
                        </span>
                        <span className="mt-1 block text-sm font-semibold leading-5 text-emerald-50/72">
                          Ganti kategori analisis untuk lihat sub-kategori, Gudang vs Workshop, dan Movement Actual tanpa mengubah angka resmi flow.
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 sm:justify-end">
                      {[
                        globalKpiCards.filter((c) => c.label !== 'Global totals').length > 0 ? 'context' : null,
                        breakdownKpiCards.length > 0 ? 'gudang/workshop' : null,
                        subKpiCards.length > 0 ? 'sub-kategori' : null,
                        movementCategoryKpiCards.length > 0 ? 'movement' : null,
                      ].filter(Boolean).map((label) => (
                        <span key={label} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-lime-100/80">
                          {label}
                        </span>
                      ))}
                    </span>
                  </button>
                </div>
              )}

              {(!isMonthlyStockMovement || monthlySecondaryOpen) && globalKpiCards.filter((c) => c.label !== 'Global totals').length > 0 && (
              <div>
                <p className="mb-1 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Context · full scope</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {globalKpiCards.filter((c) => c.label !== 'Global totals').slice(0, isMonthlyStockMovement ? 6 : 10).map((kpi) => {
                    const canFilter = Boolean(viewerProfile.kpiPresetByLabel?.[kpi.label])
                    return (
                      <div
                        key={`g-${kpi.label}`}
                        role={canFilter ? 'button' : undefined}
                        tabIndex={canFilter ? 0 : undefined}
                        onClick={() => {
                          if (canFilter) applyKpiFilter(kpi.label)
                        }}
                        onKeyDown={(event) => {
                          if (!canFilter) return
                          if (event.key === 'Enter' || event.key === ' ') applyKpiFilter(kpi.label)
                        }}
                        className={`rc-kpi-surface group relative min-h-[108px] rounded-2xl border-2 border-emerald-400/25 bg-white/[0.06] p-4 pr-12 text-left text-white shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all ${canFilter ? 'cursor-pointer hover:-translate-y-1 hover:border-lime-300/50 hover:bg-emerald-400/12 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.15)]' : 'cursor-default'}`}
                      >
                        <button
                          type="button"
                          onClick={(event) => openKpiSqlDebug(event, kpi)}
                          title="SQL sederhana KPI ini"
                          className="rc-sql-debug absolute right-3 top-3 z-10 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 hover:text-white/80"
                        >
                          SQL
                        </button>
                        <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/50">{kpi.label}</span>
                        <span className="rc-metric mt-2 block text-3xl font-black tracking-tight text-lime-200 whitespace-normal break-all leading-tight">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        <span className="mt-1 block text-[12px] font-semibold text-white/50">{kpi.description}</span>
                        {kpi.metrics && kpi.metrics.length > 1 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {kpi.metrics.slice(0, 8).map((metric) => (
                              <span key={metric.key} className="rounded border border-white/10 bg-black/20 px-1 py-0.5 text-[9px] font-bold text-white/70">
                                {metric.label}: {compactMetric(metric.value, metric.key, metric.label)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )}

              {(!isMonthlyStockMovement || monthlySecondaryOpen) && breakdownKpiCards.length > 0 && (
                <div>
                  <p className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200/85">
                    <span>Breakdown</span>
                    <span className="rc-scope-chip text-amber-100/90">
                      Gudang vs Workshop
                    </span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {breakdownKpiCards.map((kpi) => (
                      <button
                        key={`b-${kpi.groupField}-${kpi.groupKey}`}
                        type="button"
                        onClick={() => applySubKpiCardFilter(kpi)}
                        className="group rounded-2xl border-2 border-amber-400/35 bg-amber-500/12 p-4 text-left text-white shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-1 hover:border-lime-300/50 hover:bg-amber-400/18 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.12)] focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/75">
                              ItemType split
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-1 block truncate text-lg font-black text-amber-50 leading-tight">{kpi.label}</span>
                            <span className="mt-1 block truncate text-[12px] font-semibold text-white/50">{kpi.description}</span>
                          </div>
                          <span className="rc-metric shrink-0 text-2xl font-black tracking-tight text-lime-200 whitespace-normal break-all leading-tight">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 shadow-inner">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="mt-0.5 block text-sm font-black text-lime-100 whitespace-normal break-all leading-tight">{compactMetric(metric.value, metric.key, metric.label)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isMonthlyStockMovement && subKpiCards.length > 0 && (
                <div>
                  <p className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-300/80">
                    <span>
                      Sub-category · {displayColumnLabel(subKpiCards[0]?.groupField ?? activeTableGroupColumn ?? 'group')}
                    </span>
                    <span className="rc-scope-chip text-sky-100/85">
                      {subKpiCards.length} grup
                    </span>
                  </p>
                  <div className="rc-breakdown-scroll grid max-h-[18rem] grid-cols-1 gap-2 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {(isMonthlyStockMovement ? subKpiCards.slice(0, 12) : subKpiCards).map((kpi) => (
                      <button
                        key={`s-${kpi.groupField}-${kpi.groupKey}`}
                        type="button"
                        onClick={() => applySubKpiCardFilter(kpi)}
                        className="group rounded-2xl border-2 border-sky-400/30 bg-sky-500/12 p-4 text-left text-white shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-1 hover:border-lime-300/50 hover:bg-sky-400/18 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_20px_rgba(14,165,233,0.12)] focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-200/70">
                              Sub filter
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-1 block truncate text-lg font-black text-sky-50 leading-tight">{kpi.label}</span>
                            <span className="mt-1 block truncate text-[12px] font-semibold text-white/50">{kpi.description}</span>
                          </div>
                          <span className="rc-metric shrink-0 text-2xl font-black tracking-tight text-lime-200 whitespace-normal break-all leading-tight">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-2 py-1 text-[9px] font-black uppercase text-sky-100/75">
                            group={kpi.groupField}
                          </span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 shadow-inner">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="mt-0.5 block text-sm font-black text-lime-100 whitespace-normal break-all leading-tight">{compactMetric(metric.value, metric.key, metric.label)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isMonthlyStockMovement && movementCategoryKpiCards.length > 0 && (
                <div className="border-t border-emerald-400/20 pt-3">
                  <p className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200/90">
                    <span>Movement category</span>
                    <span className="rc-scope-chip text-emerald-100/85">
                      {movementCategoryKpiCards.length} · window {activeMonthlyMovementWindow}
                    </span>
                  </p>
                  <div className="rc-breakdown-scroll grid max-h-[18rem] grid-cols-1 gap-2 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {(isMonthlyStockMovement ? movementCategoryKpiCards.slice(0, 12) : movementCategoryKpiCards).map((kpi) => (
                      <div
                        key={`mc-${kpi.groupField}-${kpi.groupKey}`}
                        className="group relative rounded-2xl border-2 border-emerald-400/35 bg-emerald-500/12 p-4 pr-12 text-left text-white shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-1 hover:border-lime-300/50 hover:bg-emerald-400/18 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.15)]"
                      >
                        <button
                          type="button"
                          onClick={(event) => openKpiSqlDebug(event, kpi)}
                          title="SQL sederhana KPI ini"
                          className="rc-sql-debug absolute right-3 top-3 z-10 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 hover:text-white/80"
                        >
                          SQL
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubKpiCardFilter(kpi)}
                          className="w-full text-left focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                        >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/75">
                              Actual movement
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-1 block truncate text-lg font-black text-emerald-50 leading-tight">{kpi.label}</span>
                            <span className="mt-1 block truncate text-[12px] font-semibold text-white/50">{kpi.description}</span>
                          </div>
                          <span className="rc-metric shrink-0 text-2xl font-black tracking-tight text-lime-200 whitespace-normal break-all leading-tight">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-100/80">
                            MovementCategory
                          </span>
                          <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-black uppercase text-amber-100/75">
                            window={activeMonthlyMovementWindow}
                          </span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 shadow-inner">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="mt-0.5 block text-sm font-black text-lime-100 whitespace-normal break-all leading-tight">{compactMetric(metric.value, metric.key, metric.label)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
  )
}

export default MonthlyStockRingkasan
