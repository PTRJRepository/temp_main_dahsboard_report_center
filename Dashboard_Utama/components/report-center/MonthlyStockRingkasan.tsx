'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
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
  payload: { summary?: DbRow; metadata?: DbRow } | null
  appliedFilters: ReportFilterInput
  viewerProfile: { kpiPresetByLabel?: Record<string, string> }
  compactMetric: (value: unknown, field?: string, label?: string) => string
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (field: string) => string
  openKpiSqlDebug: (event: { preventDefault: () => void; stopPropagation: () => void }, kpi: any) => void
  applyKpiFilter: (label: string) => void
  applySubKpiCardFilter: (kpi: any) => void
  applyMonthlyAnalysisGroup: (groupBy: string) => void
  applyMonthlyMovementWindow: (window: string) => void
  commitReportFilters: (filters: ReportFilterInput, message: string | null) => void
  setReportInfoVisible: (value: boolean) => void
  setReportInfoManuallyOpened: (value: boolean) => void
  setManualFilterOpen: (value: boolean) => void
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
    openKpiSqlDebug,
    applyKpiFilter,
    applySubKpiCardFilter,
    applyMonthlyAnalysisGroup,
    applyMonthlyMovementWindow,
    commitReportFilters,
    setReportInfoVisible,
    setReportInfoManuallyOpened,
    setManualFilterOpen,
  } = props

  const MONTHLY_ANALYSIS_GROUP_OPTIONS = analysisGroupOptions
  const MONTHLY_MOVEMENT_WINDOW_OPTIONS = movementWindowOptions

  return (
        <div className="rc-ringkasan sticky top-0 z-30 mt-4 space-y-2 rounded-xl border border-lime-400/15 bg-[#071426]/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md">
          {/* Hide sticky grand strip when official flow cards already carry open→close story (avoids double totals). */}
          {stickyGrandTotals.length > 0 && !(isMonthlyStockMovement && flowKpiCards.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-1 pb-2">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-lime-300/80">Ringkasan cepat</span>
              {stickyGrandTotals.slice(0, 6).map((item) => (
                <div
                  key={item.key}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-lime-400/20 bg-lime-400/10 px-2 py-1"
                  title={String(item.label)}
                >
                  <span className="rc-kpi-label truncate text-lime-100/70">{item.label}</span>
                  <span className="rc-kpi-value text-xs font-semibold text-lime-100">{compactMetric(item.value, item.key, item.label)}</span>
                </div>
              ))}
            </div>
          )}
          {isMonthlyStockMovement && (
            <div className="grid gap-2 border-b border-white/10 px-1 pb-2 md:grid-cols-[minmax(130px,0.55fr)_minmax(170px,0.7fr)_minmax(170px,0.7fr)_auto]">
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Actual period</span>
                <input
                  type="month"
                  value={String(requestFilters.period ?? payload?.metadata?.actualPeriod ?? '')}
                  onChange={(event) => {
                    const period = event.target.value || undefined
                    commitReportFilters({
                      ...appliedFilters,
                      period,
                      accYear: undefined,
                      accMonth: undefined,
                      actualYear: undefined,
                      actualMonth: undefined,
                    }, period ? `Actual period ${period} diterapkan dari KPI card rail.` : 'Current period diterapkan dari KPI card rail.')
                  }}
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Analysis group</span>
                <select
                  value={resolvedMonthlyAnalysisGroup}
                  onChange={(event) => applyMonthlyAnalysisGroup(event.target.value)}
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
                >
                  {MONTHLY_ANALYSIS_GROUP_OPTIONS.map((option) => (
                    <option key={option.field} value={option.field}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Movement period</span>
                <select
                  value={activeMonthlyMovementWindow}
                  onChange={(event) => applyMonthlyMovementWindow(event.target.value)}
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
                >
                  {MONTHLY_MOVEMENT_WINDOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setReportInfoVisible(true)
                    setReportInfoManuallyOpened(true)
                    setManualFilterOpen(true)
                  }}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-[10px] font-black text-white/65 hover:bg-white/10 hover:text-white"
                >
                  More filters
                </button>
              </div>
            </div>
          )}
          {kpiCards.length > 0 && (
            <div className="space-y-2">
              {flowKpiCards.length > 0 && (
                <div className="space-y-3">
                  <p className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-lime-200/75">
                    <span>Ringkasan</span>
                    <span className="rc-scope-chip text-[10px] text-lime-100/80">
                      {isMonthlyStockMovement
                        ? '14 kolom resmi PDF · Opening → Inventory → Issued → Purchasing → Closing'
                        : 'Alur stok'}
                    </span>
                    {isMonthlyStockMovement && (
                      <span className="rc-scope-chip">Ringkasan server (terfilter) · bukan sampel</span>
                    )}
                  </p>
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
                      <div key={group.id} className="space-y-1.5">
                        {isMonthlyStockMovement && (
                          <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{group.title}</p>
                        )}
                        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${isMonthlyStockMovement ? 'md:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
                          {cards.map((kpi) => {
                            const amountMetric = (kpi.metrics ?? []).find((m) => /Amount|TotalItem/i.test(m.key)) ?? kpi.metrics?.[0]
                            const qtyMetric = (kpi.metrics ?? []).find((m) => /Qty/i.test(m.key))
                            const nested = !isMonthlyStockMovement
                              ? (kpi.metrics ?? []).filter((m) => m.key !== 'IssuedTotalAmount' && m.key !== 'TotalItem')
                              : []
                            return (
                              <div
                                key={`flow-${kpi.sourceField ?? kpi.label}`}
                                className={`group relative min-h-[96px] rounded-xl border p-3 pr-12 text-left text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${kpi.tone}`}
                                title={[kpi.sourceTable, kpi.sourceField].filter(Boolean).join(' · ')}
                              >
                                <button
                                  type="button"
                                  onClick={(event) => openKpiSqlDebug(event, kpi)}
                                  title="SQL sederhana KPI ini"
                                  className="rc-sql-debug absolute right-2 top-2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                >
                                  SQL
                                </button>
                                <span className="rc-kpi-label block truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/55">
                                  {kpi.label}
                                </span>
                                <span className="rc-kpi-value mt-1 block text-xl font-black tracking-tight text-lime-100 whitespace-normal break-all">
                                  {compactMetric(kpi.value, amountMetric?.key ?? kpi.sourceField, kpi.label)}
                                </span>
                                {isMonthlyStockMovement && qtyMetric && kpi.sourceField !== 'TotalItem' ? (
                                  <span className="mt-1 block text-[11px] font-bold tabular-nums text-white/70">
                                    Qty {compactMetric(qtyMetric.value, qtyMetric.key, qtyMetric.label)}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-white/60">
                                    {kpi.description}
                                  </span>
                                )}
                                {nested.length > 0 && (
                                  <div className="mt-2 grid grid-cols-2 gap-1">
                                    {nested.slice(0, 4).map((metric) => (
                                      <div
                                        key={metric.key}
                                        className="rounded-md border border-white/10 bg-black/20 px-1.5 py-1"
                                        title={`${metric.label}: ${formatValue(metric.value, metric.key)}`}
                                      >
                                        <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/50">
                                          {metric.label}
                                        </span>
                                        <span className="block text-[11px] font-black text-white/90 whitespace-normal break-all">
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
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-1 pt-2">
                  <button
                    type="button"
                    onClick={() => setMonthlySecondaryOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
                    aria-expanded={monthlySecondaryOpen}
                  >
                    {monthlySecondaryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {monthlySecondaryOpen ? 'Sembunyikan analisis lanjutan' : 'Tampilkan analisis lanjutan'}
                    <span className="rc-scope-chip">
                      {[
                        globalKpiCards.filter((c) => c.label !== 'Global totals').length > 0 ? 'context' : null,
                        breakdownKpiCards.length > 0 ? 'gudang/workshop' : null,
                        subKpiCards.length > 0 ? 'sub-kategori' : null,
                        movementCategoryKpiCards.length > 0 ? 'movement' : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </div>
              )}

              {(!isMonthlyStockMovement || monthlySecondaryOpen) && globalKpiCards.filter((c) => c.label !== 'Global totals').length > 0 && (
              <div>
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Context · full scope</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
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
                        className={`group relative min-h-[82px] rounded-xl border border-emerald-400/20 bg-white/[0.04] p-3 pr-12 text-left text-white transition ${canFilter ? 'cursor-pointer hover:-translate-y-0.5 hover:border-lime-300/40 hover:bg-emerald-400/10' : 'cursor-default'}`}
                      >
                        <button
                          type="button"
                          onClick={(event) => openKpiSqlDebug(event, kpi)}
                          title="SQL sederhana KPI ini"
                          className="rc-sql-debug absolute right-2 top-2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          SQL
                        </button>
                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">{kpi.label}</span>
                        <span className="mt-1 block text-xl font-black tracking-tight text-lime-200 whitespace-normal break-all">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-white/55">{kpi.description}</span>
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
                  <p className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/80">
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
                        className="group rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-left text-white transition hover:-translate-y-0.5 hover:border-lime-300/45 hover:bg-amber-400/15 focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-200/75">
                              ItemType split
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-black text-amber-50">{kpi.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/55">{kpi.description}</span>
                          </div>
                          <span className="shrink-0 text-lg font-black tracking-tight text-lime-200 whitespace-normal break-all">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-2 grid grid-cols-3 gap-1">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="block text-xs font-black text-lime-100 whitespace-normal break-all">{compactMetric(metric.value, metric.key, metric.label)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(!isMonthlyStockMovement || monthlySecondaryOpen) && subKpiCards.length > 0 && (
                <div>
                  <p className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300/75">
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
                        className="group rounded-xl border border-sky-400/25 bg-sky-500/10 p-3 text-left text-white transition hover:-translate-y-0.5 hover:border-lime-300/45 hover:bg-sky-400/15 focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-200/70">
                              Sub filter
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-black text-sky-50">{kpi.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/55">{kpi.description}</span>
                          </div>
                          <span className="shrink-0 text-lg font-black tracking-tight text-lime-200 whitespace-normal break-all">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded border border-sky-300/25 bg-sky-300/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-100/75">
                            group={kpi.groupField}
                          </span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="block text-xs font-black text-lime-100 whitespace-normal break-all">{compactMetric(metric.value, metric.key, metric.label)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(!isMonthlyStockMovement || monthlySecondaryOpen) && movementCategoryKpiCards.length > 0 && (
                <div className="border-t border-emerald-400/15 pt-3">
                  <p className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/85">
                    <span>Movement category</span>
                    <span className="rc-scope-chip text-emerald-100/85">
                      {movementCategoryKpiCards.length} · window {activeMonthlyMovementWindow}
                    </span>
                  </p>
                  <div className="rc-breakdown-scroll grid max-h-[18rem] grid-cols-1 gap-2 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {(isMonthlyStockMovement ? movementCategoryKpiCards.slice(0, 12) : movementCategoryKpiCards).map((kpi) => (
                      <div
                        key={`mc-${kpi.groupField}-${kpi.groupKey}`}
                        className="group relative rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 pr-12 text-left text-white transition hover:-translate-y-0.5 hover:border-lime-300/45 hover:bg-emerald-400/15"
                      >
                        <button
                          type="button"
                          onClick={(event) => openKpiSqlDebug(event, kpi)}
                          title="SQL sederhana KPI ini"
                          className="rc-sql-debug absolute right-2 top-2 z-10 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
                            <span className="flex items-center gap-1 truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/75">
                              Actual movement
                              <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-black text-emerald-50">{kpi.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/55">{kpi.description}</span>
                          </div>
                          <span className="shrink-0 text-lg font-black tracking-tight text-lime-200 whitespace-normal break-all">{compactMetric(kpi.value, kpi.sourceField ?? kpi.metrics?.[0]?.key, kpi.label)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-100/80">
                            MovementCategory
                          </span>
                          <span className="rounded border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-100/75">
                            window={activeMonthlyMovementWindow}
                          </span>
                        </div>
                        {kpi.metrics && kpi.metrics.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {kpi.metrics.map((metric) => (
                              <div key={metric.key} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/45">{metric.label}</span>
                                <span className="block text-xs font-black text-lime-100 whitespace-normal break-all">{compactMetric(metric.value, metric.key, metric.label)}</span>
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
