'use client'

import {
  Bot,
  Boxes,
  ChevronRight,
  Database,
  Filter,
  Layers3,
  PackageSearch,
  Table2,
} from 'lucide-react'
import type { InventoryAnalyticsContract } from '@/lib/reports/inventory/analytics-contract'
import type { ReportBreakdownEntry, ReportFilterAction } from '@/lib/reports/report-experience'
import type { ReportFilterInput } from '@/lib/reports/report-filtering'

type ReportAnalysisBandProps = {
  analytics?: InventoryAnalyticsContract
  activeFilters: ReportFilterInput
  sourceLabel: string
  sourceDescription: string
  reportTitle?: string
  reportDescription?: string
  reportCode?: string
  generatedAt?: string
  loading?: boolean
  onFilterAction: (action: ReportFilterAction, label?: string) => void
  onAskQuestion?: (question: string) => void
}

const dimensionLabels: Record<string, string> = {
  'item-code': 'Item Code',
  'movement-category': 'Movement Category',
  'product-type': 'Product Type',
  'product-category': 'Product Category',
  'item-type': 'Item Type',
  'stock-analysis': 'Stock Analysis Code',
  location: 'Location',
  chart: 'Chart',
}

const dimensionNotes: Record<string, string> = {
  'item-code': 'Kode item detail dari tabel report.',
  'movement-category': 'Kategori periodik dari aktivitas movement.',
  'product-type': 'Taxonomy master product type.',
  'product-category': 'Kategori barang dari master item.',
  'item-type': 'Tipe item tersimpan.',
  'stock-analysis': 'Kode stock analysis tersimpan, bukan movement periodik.',
  location: 'Gudang atau lokasi stok.',
  chart: 'Breakdown chart report.',
}

const dimensionTone: Record<string, string> = {
  'item-code': 'border-white/10 bg-white/[0.05] text-white/85',
  'movement-category': 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  'product-type': 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  'product-category': 'border-lime-300/25 bg-lime-400/10 text-lime-100',
  'item-type': 'border-sky-300/25 bg-sky-400/10 text-sky-100',
  'stock-analysis': 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  location: 'border-teal-300/25 bg-teal-400/10 text-teal-100',
  chart: 'border-white/10 bg-white/[0.05] text-white/80',
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatMetric(value: unknown, format?: string) {
  if (value === null || value === undefined || value === '') return '-'
  if (format === 'text') return String(value)
  const numeric = toNumber(value)
  if (!numeric && typeof value === 'string' && !/^[\d.,\s-]+$/.test(value)) return value
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

function cleanBreakdownLabel(entry: ReportBreakdownEntry) {
  const prefix = dimensionLabels[entry.dimensionId ?? '']
  if (prefix) {
    const stripped = entry.label.replace(new RegExp(`^${prefix}\\s*-\\s*`, 'i'), '').trim()
    if (stripped !== entry.label) return stripped
  }
  return entry.label.replace(/^[^-]+-\s*/, '').trim()
}

function activeFilterCount(filters: ReportFilterInput) {
  return Object.entries(filters).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '').length
}

function filterSummary(filters: ReportFilterInput) {
  const entries = Object.entries(filters)
    .filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '')
    .slice(0, 5)

  if (entries.length === 0) return 'Full report scope'
  return entries.map(([key, value]) => {
    if (key === 'columnFilters' && Array.isArray(value)) return `${value.length} column filter`
    return `${key}: ${String(value)}`
  }).join(' | ')
}

function topBreakdownByDimension(breakdowns: ReportBreakdownEntry[], dimensionId: string) {
  return breakdowns
    .filter((entry) => entry.dimensionId === dimensionId)
    .sort((left, right) => toNumber(right.value) - toNumber(left.value))[0]
}

function questionForBreakdown(entry: ReportBreakdownEntry) {
  const label = cleanBreakdownLabel(entry)
  if (entry.dimensionId === 'movement-category') {
    return `Apa penyebab dan prioritas tindakan untuk movement category ${label} pada scope report ini?`
  }
  if (entry.dimensionId === 'stock-analysis') {
    return `Apa arti stock analysis code ${label}, item apa yang paling material, dan apakah berbeda dari movement category periodik?`
  }
  if (entry.dimensionId === 'location') {
    return `Gudang atau lokasi ${label} menyumbang risiko atau nilai terbesar apa pada scope ini?`
  }
  return `Apa insight utama dari ${dimensionLabels[entry.dimensionId ?? 'breakdown'] ?? 'breakdown'} ${label} pada scope ini?`
}

export function ReportAnalysisBand({
  analytics,
  activeFilters,
  sourceLabel,
  sourceDescription,
  reportTitle,
  reportDescription,
  reportCode,
  generatedAt,
  loading,
  onFilterAction,
  onAskQuestion,
}: ReportAnalysisBandProps) {
  const kpis = analytics?.kpis ?? []
  const breakdowns = analytics?.breakdowns ?? []
  const detailWindow = analytics?.detailWindow
  const dimensions = analytics?.semanticDimensions ?? []
  const movementTop = topBreakdownByDimension(breakdowns, 'movement-category')
  const stockAnalysisTop = topBreakdownByDimension(breakdowns, 'stock-analysis')
  const monthlyFlowBreakdowns = breakdowns
    .filter((entry) => entry.dimensionId === 'chart' && entry.id.startsWith('monthly-flow-'))
    .slice(0, 5)
  const hasMonthlyStockFlow = monthlyFlowBreakdowns.length > 0
  const topBreakdowns = breakdowns
    .filter((entry) => entry.filterAction)
    .sort((left, right) => toNumber(right.value) - toNumber(left.value))
    .slice(0, 8)
  // Movement Category always in analysis text rail (even when monthly flow present).
  const textAlternativeDimensions = hasMonthlyStockFlow
    ? ['movement-category', 'stock-analysis', 'location', 'item-code', 'chart']
    : ['movement-category', 'stock-analysis', 'product-type', 'product-category', 'location']
  const title = reportTitle?.trim() || 'Ringkasan Report'
  const description = reportDescription?.trim()
    || 'Ringkasan angka, dimensi grouping, dan drill-down untuk report aktif pada scope filter yang sama.'

  return (
    <section className="mt-5 overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.16),transparent_30%),linear-gradient(135deg,#102b1b,#071426_58%,#12100a)] text-white shadow-[0_26px_80px_rgba(0,0,0,0.28)]" aria-label="Report analytics cockpit">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-200">
                {reportCode ? `Report ${reportCode}` : 'Ringkasan Report'}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                {title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/60">
                {description}
              </p>
              <p className="mt-2 text-xs font-semibold text-white/40">
                Klik KPI/breakdown untuk filter tabel & export. Angka KPI = scope server, bukan halaman tabel saja.
              </p>
            </div>
            <div className="min-w-[220px] max-w-sm rounded-2xl border border-white/10 bg-black/18 p-3">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                <Database size={14} />
                Scope Data
              </div>
              <p className="mt-2 text-sm font-black text-white">{sourceLabel}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-white/45">{sourceDescription}</p>
              <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-emerald-100">
                {activeFilterCount(activeFilters)} filter aktif | {filterSummary(activeFilters)}
              </p>
            </div>
          </div>

          {/* KPI numbers live in sticky top rail only — avoid duplicate cards here. */}
          {!loading && kpis.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/55">
              Analytics contract belum tersedia dari API untuk report ini. Tabel dan export tetap memakai payload report aktif.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">Taxonomy rail</p>
                  <h3 className="mt-1 text-lg font-black tracking-[-0.03em]">Dimensi grouping resmi</h3>
                </div>
                <Layers3 size={18} className="text-emerald-200" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {dimensions.length > 0 ? dimensions.map((dimensionId) => {
                  const top = topBreakdownByDimension(breakdowns, dimensionId)
                  return (
                    <button
                      key={dimensionId}
                      type="button"
                      onClick={() => {
                        if (top?.filterAction) onFilterAction(top.filterAction, cleanBreakdownLabel(top))
                      }}
                      disabled={!top?.filterAction}
                      className={cx(
                        'group rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-lime-300/50 disabled:cursor-default disabled:opacity-60',
                        dimensionTone[dimensionId] ?? dimensionTone.chart,
                        top?.filterAction && 'hover:-translate-y-0.5 hover:bg-white/[0.09]',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black">{dimensionLabels[dimensionId] ?? dimensionId}</span>
                        {top?.filterAction ? <ChevronRight size={14} className="transition group-hover:translate-x-0.5" /> : null}
                      </span>
                      <span className="mt-1 block text-xs font-semibold opacity-70">{dimensionNotes[dimensionId] ?? 'Report dimension'}</span>
                      <span className="mt-3 block truncate text-xs font-black">
                        {top ? `${cleanBreakdownLabel(top)} | ${formatMetric(top.value, top.format)}` : 'No breakdown yet'}
                      </span>
                    </button>
                  )
                }) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/55 sm:col-span-2">
                    API belum mengirim semantic dimensions untuk report ini.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                    {hasMonthlyStockFlow ? 'Monthly stock flow' : 'Movement vs taxonomy'}
                  </p>
                  <h3 className="mt-1 text-lg font-black tracking-[-0.03em]">
                    {hasMonthlyStockFlow ? 'Ringkasan dari tabel report' : 'Pemisahan kategori penting'}
                  </h3>
                </div>
                <Boxes size={18} className="text-amber-200" />
              </div>
              {hasMonthlyStockFlow ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {monthlyFlowBreakdowns.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/70">{entry.label}</p>
                        <p className="mt-2 truncate text-lg font-black text-amber-50">{formatMetric(entry.value, entry.format)}</p>
                        <p className="mt-1 text-xs font-semibold text-amber-50/65">{entry.evidence.valuePath ?? 'summary'}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold leading-5 text-white/58">
                    Flow bulanan (opening → issue → receive → closing) terpisah dari Movement Category periodik. Kedua analisis tetap ditampilkan.
                  </p>
                </>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">Movement Actual · computed</p>
                  <p className="mt-2 truncate text-lg font-black text-emerald-50">{movementTop ? cleanBreakdownLabel(movementTop) : '-'}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-50/65">
                    Fast/Slow/Dead/Stale dihitung otomatis dari StockIssue window — bukan kolom master.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/70">Stock Analysis · stored</p>
                  <p className="mt-2 truncate text-lg font-black text-amber-50">{stockAnalysisTop ? cleanBreakdownLabel(stockAnalysisTop) : '-'}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-50/65">
                    Kode di master/item (DEADS/MEMOV/…) — data tabel, bukan auto-calc.
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold leading-5 text-white/58">
                Taxonomy tersimpan (Stock Analysis, Product Type/Category) ≠ analisis computed (Movement Actual). Sub-category KPI = stored only. Computed analysis = rail sendiri; analisis auto-calc lain nanti juga terpisah, tidak digabung ke sub.
              </p>
              {onAskQuestion ? (
                <button
                  type="button"
                  onClick={() => onAskQuestion(
                    hasMonthlyStockFlow
                      ? 'Apa insight utama dari opening, issue, goods receive, return, closing, dan stock analysis terbesar pada RPTIN1000015 scope ini?'
                      : movementTop
                      ? questionForBreakdown(movementTop)
                      : 'Apa movement category, stock analysis, product type, dan item detail yang paling perlu diprioritaskan pada scope ini?',
                  )}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-lime-300/25 bg-lime-400/10 px-3 py-2 text-xs font-black text-lime-100 hover:bg-lime-400/15 focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                >
                  <Bot size={14} />
                  Tanya AI dari scope ini
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="border-t border-white/10 bg-black/20 p-4 sm:p-5 xl:border-l xl:border-t-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Detail window</p>
                <h3 className="mt-1 text-lg font-black">Server KPI tetap full-scope</h3>
              </div>
              <Table2 size={18} className="text-cyan-200" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['Total', detailWindow?.totalRows],
                ['Filtered', detailWindow?.filteredRows],
                ['Returned', detailWindow?.returnedRows],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">{label}</p>
                  <p className="mt-1 text-lg font-black text-white">{formatMetric(value as number | undefined)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-white/55">
              {detailWindow?.partial
                ? `Table window ${detailWindow.strategy}; export tetap fetch scope penuh sesuai filter.`
                : `Table window ${detailWindow?.strategy ?? 'all'}; nilai KPI tidak bergantung pada pagination.`}
            </p>
            {generatedAt ? <p className="mt-2 text-[11px] font-bold text-white/35">Generated: {generatedAt}</p> : null}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
              <Filter size={14} />
              Clickable breakdowns
            </div>
            <div className="mt-3 space-y-2">
              {topBreakdowns.length > 0 ? topBreakdowns.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (entry.filterAction) onFilterAction(entry.filterAction, cleanBreakdownLabel(entry))
                  }}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-3 text-left hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{cleanBreakdownLabel(entry)}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-white/40">{dimensionLabels[entry.dimensionId ?? 'chart'] ?? entry.dimensionId} | {entry.scope}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-black text-lime-100">
                    {formatMetric(entry.value, entry.format)}
                    <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-black/18 p-3 text-sm font-semibold text-white/45">
                  Tidak ada breakdown filterable untuk scope ini.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
              <PackageSearch size={14} />
              Text alternative
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.06] text-white/45">
                  <tr>
                    <th className="px-3 py-2 font-black">Dimension</th>
                    <th className="px-3 py-2 font-black">Top label</th>
                    <th className="px-3 py-2 text-right font-black">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {textAlternativeDimensions.map((dimensionId) => {
                    const entry = topBreakdownByDimension(breakdowns, dimensionId)
                    return (
                      <tr key={dimensionId} className="border-t border-white/10">
                        <td className="px-3 py-2 font-semibold text-white/50">{dimensionLabels[dimensionId]}</td>
                        <td className="max-w-[150px] truncate px-3 py-2 font-black text-white">{entry ? cleanBreakdownLabel(entry) : '-'}</td>
                        <td className="px-3 py-2 text-right font-black text-lime-100">{entry ? formatMetric(entry.value, entry.format) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default ReportAnalysisBand
