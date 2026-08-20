'use client'

import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * MovementTrend — grafik tren agregat periode, dinamis mengikuti metric.
 *
 * Prefer `periodSummary` from movement-matrix (full inventory universe):
 * - amount/valuation → stock valuation all items (incl. no-movement)
 * - qty / docs → issue activity full window
 * Fallback: sum matrix rows (top-N only) when summary missing.
 */

type MatrixMetric = 'qty' | 'amount' | 'freq'

type ApiMatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[]; valuation?: number[] }
}

type PeriodSummary = {
  period: string
  valuation: number
  issueQty: number
  issueAmount: number
  issueDocs: number
}

type MovementTrendProps = {
  periods: string[]
  rows: ApiMatrixRow[]
  /** Full-scope totals from matrix API (all stock items). */
  periodSummary?: PeriodSummary[]
  metric: MatrixMetric
  onMetricChange: (metric: MatrixMetric) => void
  loading?: boolean
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} T`
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} rb`
  return `${Math.round(value)}`
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const mi = Number(m) - 1
  return `${MONTH_ID[mi] ?? m} ${String(y).slice(2)}`
}

export default function MovementTrend({ periods, rows, periodSummary, metric, onMetricChange, loading }: MovementTrendProps) {
  const points = useMemo(() => {
    const summaryByPeriod = new Map((periodSummary ?? []).map((s) => [s.period, s]))
    return periods.map((period, i) => {
      const summary = summaryByPeriod.get(period)
      if (summary) {
        return {
          period,
          label: periodLabel(period),
          // Valuasi = full stock (all items, incl. no-movement). Qty/docs = issue activity.
          qty: Number(summary.issueQty) || 0,
          amount: Number(summary.valuation) || 0,
          docs: Number(summary.issueDocs) || 0,
          issueAmount: Number(summary.issueAmount) || 0,
          scope: 'full' as const,
        }
      }
      // Fallback top-N matrix rows (prefer valuation cells when present)
      let qty = 0
      let amount = 0
      let docs = 0
      let issueAmount = 0
      for (const row of rows) {
        qty += row.cells.qty[i] ?? 0
        docs += row.cells.docs[i] ?? 0
        issueAmount += row.cells.amount[i] ?? 0
        const val = row.cells.valuation?.[i]
        amount += Number(val != null ? val : row.cells.amount[i] ?? 0) || 0
      }
      return {
        period,
        label: periodLabel(period),
        qty,
        amount,
        docs,
        issueAmount,
        scope: 'topn' as const,
      }
    })
  }, [periods, rows, periodSummary])

  const activeKey: 'qty' | 'amount' | 'docs' = metric === 'freq' ? 'docs' : metric
  const usesFullScope = points.some((p) => p.scope === 'full')

  const total = points.reduce((s, p) => s + p[activeKey], 0)
  const peak = points.length > 0 ? points.reduce((acc, p) => (p[activeKey] > acc[activeKey] ? p : acc), points[0]) : null
  const trough = points.length > 0 ? points.reduce((acc, p) => (p[activeKey] < acc[activeKey] ? p : acc), points[0]) : null
  const avg = points.length > 0 ? total / points.length : 0
  const last = points.length > 1 ? points[points.length - 1] : null
  const prev = points.length > 1 ? points[points.length - 2] : null
  const deltaPct =
    last && prev && prev[activeKey] !== 0 ? ((last[activeKey] - prev[activeKey]) / Math.abs(prev[activeKey])) * 100 : null
  // Arah tren: bandingkan rata-rata paruh akhir vs paruh awal (robust untuk >2 titik).
  const trendDir = useMemo(() => {
    if (points.length < 4) return null
    const half = Math.floor(points.length / 2)
    const first = points.slice(0, half).reduce((s, p) => s + p[activeKey], 0) / half
    const second = points.slice(half).reduce((s, p) => s + p[activeKey], 0) / (points.length - half)
    if (first === 0) return null
    const drift = ((second - first) / Math.abs(first)) * 100
    if (drift > 8) return { label: 'naik', pct: drift }
    if (drift < -8) return { label: 'turun', pct: drift }
    return { label: 'datar', pct: drift }
  }, [points, activeKey])

  const metricLabel = metric === 'qty'
    ? 'qty issue'
    : metric === 'freq'
      ? 'frekuensi dok'
      : 'valuasi stok (Rp)'
  const formatValue = (v: number) => (metric === 'amount' ? `Rp ${formatCompact(v)}` : formatCompact(v))

  // Analisis lintas-metrik — dibaca dari agregat yang sama, tak peduli toggle aktif.
  const totalQty = points.reduce((s, p) => s + p.qty, 0)
  const totalAmount = points.reduce((s, p) => s + p.amount, 0)
  const totalDocs = points.reduce((s, p) => s + p.docs, 0)
  const totalIssueAmount = points.reduce((s, p) => s + p.issueAmount, 0)
  const avgUnitPrice = totalQty > 0 ? totalIssueAmount / totalQty : 0
  const qtyPerDoc = totalDocs > 0 ? totalQty / totalDocs : 0
  const amountPerDoc = totalDocs > 0 ? totalIssueAmount / totalDocs : 0
  const peakShare = peak && total > 0 ? (peak[activeKey] / total) * 100 : 0

  if (loading && points.length === 0) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat tren movement…</p>
      </div>
    )
  }

  // Only blank when no period axis at all. Zero-row matrix still plots zeros so
  // frekuensi / total activity line does not disappear on sparse windows.
  if (points.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-[24px] border-white/10 bg-white/[0.03] p-3">
        <TrendHeader
          metric={metric}
          metricLabel={metricLabel}
          onMetricChange={onMetricChange}
          total={0}
          avg={0}
          pointCount={0}
          peakLabel={null}
          troughLabel={null}
          deltaPct={null}
          trendDir={null}
          formatValue={formatValue}
        />
        <div className="grid min-h-0 flex-1 place-items-center px-4">
          <p className="rc-data text-center text-[11px] leading-relaxed text-[var(--rc-text-faint)]">
            Tren dinamis Qty/Valuasi/Frekuensi siap begitu matriks periode tersedia.
            <br />
            <span className="text-[10px]">Bila sumber data sedang tak terjangkau, panel ini tetap siap — coba lagi saat koneksi DB pulih.</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <TrendHeader
        metric={metric}
        metricLabel={metricLabel}
        onMetricChange={onMetricChange}
        total={total}
        avg={avg}
        pointCount={points.length}
        peakLabel={peak ? peak.label : null}
        troughLabel={trough ? trough.label : null}
        deltaPct={deltaPct}
        trendDir={trendDir}
        formatValue={formatValue}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rcTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.34} />
                <stop offset="60%" stopColor="#34d399" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8fa89c', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              yAxisId="main"
              width={48}
              tick={{ fill: '#8fa89c', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <YAxis
              yAxisId="freq"
              orientation="right"
              width={40}
              hide={metric === 'freq'}
              tick={{ fill: '#a0aec0', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(52,211,153,0.4)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#0a1510',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 12,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
              }}
              labelStyle={{ color: '#a7f3d0', fontWeight: 700 }}
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value ?? 0)
                if (name === 'amount') return [`Rp ${formatCompact(v)}`, 'Valuasi stok (semua item)']
                if (name === 'qty') return [formatCompact(v), 'Qty issue']
                return [formatCompact(v), 'Dok issue']
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#8fa89c' }}
              formatter={(value) => (value === 'amount' ? 'Valuasi stok' : value === 'qty' ? 'Qty issue' : 'Dok issue')}
            />
            {/* Batang frekuensi sebagai konteks ritme — disembunyikan bila freq jadi metrik utama. */}
            {metric !== 'freq' && (
              <Bar yAxisId="freq" dataKey="docs" fill="rgba(148,163,184,0.35)" radius={[3, 3, 0, 0]} maxBarSize={16} />
            )}
            {metric === 'amount' && (
              <Area
                yAxisId="main"
                type="monotone"
                dataKey="amount"
                stroke="#34d399"
                strokeWidth={2.2}
                fill="url(#rcTrendFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#a7f3d0', stroke: '#04130c', strokeWidth: 2 }}
              />
            )}
            {metric === 'qty' && (
              <Area
                yAxisId="main"
                type="monotone"
                dataKey="qty"
                stroke="#34d399"
                strokeWidth={2.2}
                fill="url(#rcTrendFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#a7f3d0', stroke: '#04130c', strokeWidth: 2 }}
              />
            )}
            {metric === 'freq' && (
              <Line
                yAxisId="main"
                type="monotone"
                dataKey="docs"
                stroke="#f59e0b"
                strokeWidth={2.2}
                dot={{ r: 3, fill: '#f59e0b', stroke: '#04130c', strokeWidth: 1.5 }}
                activeDot={{ r: 4, fill: '#fcd34d', stroke: '#04130c', strokeWidth: 2 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="rc-data mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-[var(--rc-text-faint)]">
        {usesFullScope
          ? 'Valuasi = seluruh item stok (termasuk tanpa movement). Qty/Freq = aktivitas issue di window.'
          : `Fallback top ${rows.length} barang matriks · belum full valuation summary.`}
        {' '}Metrik: {metricLabel}.
      </p>
      <div className="rc-data mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-100/90" title="Scope valuasi tren.">
          {usesFullScope ? 'Scope: full valuasi stok' : 'Scope: top-N matriks'}
        </span>
        <span className="rounded-full border-white/10 bg-white/[0.04] px-2 py-0.5" title="Issue amount total (flow, bukan valuasi stok).">
          Issue flow <strong className="text-[var(--rc-text)]">Rp {formatCompact(totalIssueAmount)}</strong>
        </span>
        <span className="rounded-full border-white/10 bg-white/[0.04] px-2 py-0.5" title="Issue amount / qty issue.">
          Avg unit issue <strong className="text-emerald-200/90">Rp {formatCompact(avgUnitPrice)}</strong>
        </span>
        <span className="rounded-full border-white/10 bg-white/[0.04] px-2 py-0.5" title="Qty issue / dokumen.">
          Qty/dok <strong className="text-[var(--rc-text)]">{formatCompact(qtyPerDoc)}</strong>
        </span>
        <span className="rounded-full border-white/10 bg-white/[0.04] px-2 py-0.5" title="Issue amount / dokumen.">
          Rp issue/dok <strong className="text-[var(--rc-text)]">Rp {formatCompact(amountPerDoc)}</strong>
        </span>
        <span className="rounded-full border-white/10 bg-white/[0.04] px-2 py-0.5" title="Bagian periode puncak terhadap total metrik aktif.">
          Puncak menampung <strong className="text-amber-200/90">{peakShare.toFixed(0)}%</strong> total
        </span>
      </div>
    </div>
  )
}

type TrendHeaderProps = {
  metric: MatrixMetric
  metricLabel: string
  onMetricChange: (metric: MatrixMetric) => void
  total: number
  avg: number
  pointCount: number
  peakLabel: string | null
  troughLabel: string | null
  deltaPct: number | null
  trendDir: { label: string; pct: number } | null
  formatValue: (v: number) => string
}

function TrendHeader({ metric, metricLabel, onMetricChange, total, avg, pointCount, peakLabel, troughLabel, deltaPct, trendDir, formatValue }: TrendHeaderProps) {
  return (
    <div className="mb-2 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--rc-text)]">Tren movement</p>
        <p className="rc-data mt-0.5 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--rc-text-faint)]">
          <span>
            Total {metricLabel}: <strong className="text-[var(--rc-text)]">{formatValue(total)}</strong>
          </span>
          <span>
            · rata-rata <strong className="text-[var(--rc-text)]">{formatValue(avg)}</strong>/periode
          </span>
          {peakLabel && <span>· tertinggi {peakLabel}</span>}
          {troughLabel && <span>· terendah {troughLabel}</span>}
          {trendDir && (
            <span className={trendDir.label === 'naik' ? 'text-emerald-300/90' : trendDir.label === 'turun' ? 'text-amber-300/90' : 'text-[var(--rc-text-muted)]'}>
              · tren {trendDir.label}
            </span>
          )}
          {deltaPct !== null && Number.isFinite(deltaPct) && (
            <span className={deltaPct >= 0 ? 'text-emerald-300/90' : 'text-amber-300/90'}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(0)}% vs periode lalu
            </span>
          )}
          <span>· {pointCount} titik</span>
        </p>
      </div>
      <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Metrik tren">
        {(['qty', 'amount', 'freq'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metric === m}
            onClick={() => onMetricChange(m)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              metric === m ? 'bg-emerald-400/20 text-emerald-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
            }`}
          >
            {m === 'qty' ? 'Qty' : m === 'amount' ? 'Valuasi' : 'Freq'}
          </button>
        ))}
      </div>
    </div>
  )
}
