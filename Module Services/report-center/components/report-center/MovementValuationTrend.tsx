'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import MicroReportHeader from './MicroReportHeader'
import type { CategoryEvolutionPoint } from './MovementCategoryEvolution'

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const CATEGORY_ORDER = ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock'] as const
const TONE_FILL: Record<string, string> = {
  'Fast Moving': '#34d399',
  Moving: '#22d3ee',
  'Slow Moving': '#fbbf24',
  'Dead Stock': '#94a3b8',
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTH_ID[(Number(m) - 1) % 12] ?? m} ${String(y).slice(2)}`
}

type RowPoint = {
  period: string
  label: string
  total: number
} & Record<string, number | string>

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill?: string; payload?: RowPoint }>; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0)
  return (
    <div className="min-w-[190px] rounded-xl border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.95)] px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-[var(--rc-text)]">{label}</p>
      <div className="mt-1.5 space-y-0.5">
        {payload.filter((p) => Number(p.value) > 0).map((p) => (
          <p key={p.name} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[var(--rc-text-muted)]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
              {p.name}
            </span>
            <span className="rc-metric font-semibold text-[var(--rc-text)]">{formatRupiah(Number(p.value))}</span>
          </p>
        ))}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-white/10 pt-1.5 font-black">
        <span className="text-[var(--rc-text-faint)]">Total</span>
        <span className="rc-metric text-[var(--rc-forest-accent)]">{formatRupiah(total)}</span>
      </p>
    </div>
  )
}

export default function MovementValuationTrend({
  periods,
  byPeriod,
  loading,
  height = 320,
}: {
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  loading?: boolean
  height?: number
}) {
  const points = useMemo<RowPoint[]>(() => {
    return byPeriod.map((p) => {
      const row: RowPoint = { period: p.period, label: periodLabel(p.period), total: 0 }
      for (const category of CATEGORY_ORDER) {
        const amount = p.categories[category]?.amount ?? 0
        row[category] = amount
        row.total += amount
      }
      return row
    })
  }, [byPeriod])

  const grandTotal = useMemo(() => points.reduce((sum, p) => sum + p.total, 0), [points])
  const peak = useMemo(() => points.reduce<RowPoint | null>((acc, p) => (acc == null || p.total > acc.total ? p : acc), null), [points])
  const empty = !loading && points.length === 0

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Movement × valuasi per bulan"
            title="Komposisi nilai (Rp) per kategori tiap bulan"
            subtitle={
              `Tinggi bar = total nilai 4 kategori bulan itu (${periods.length} bulan, grand total ${formatRupiah(grandTotal)})` +
              (peak && peak.total > 0 ? ` · puncak ${peak.label} (${formatCompact(peak.total)})` : '')
            }
            accent="forest"
          />
        </div>
        <TrendingUp size={20} className="text-[var(--rc-forest-accent)]" />
      </div>

      <div className="mt-4">
        {loading && points.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-white/[0.04]" style={{ height }}>
            <p className="text-sm text-[var(--rc-text-faint)]">Memuat tren movement × valuasi…</p>
          </div>
        ) : empty ? (
          <div className="grid place-items-center rounded-2xl bg-white/[0.04]" style={{ height }}>
            <p className="text-sm text-[var(--rc-text-faint)]">Belum ada data issue untuk scope ini.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={points} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10, fontWeight: 700 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={16} />
              <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={48} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              {CATEGORY_ORDER.map((category, index) => (
                <Bar key={category} dataKey={category} stackId="a" fill={TONE_FILL[category]} maxBarSize={34} radius={index === 0 ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                  {index === 0 ? (
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(v: unknown) => formatCompact(Number(v))}
                      style={{ fill: '#a7f3d0', fontSize: 9, fontWeight: 800 }}
                    />
                  ) : null}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {CATEGORY_ORDER.map((category) => (
          <span key={category} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--rc-text-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_FILL[category] }} />
            {category}
          </span>
        ))}
      </div>
    </div>
  )
}
