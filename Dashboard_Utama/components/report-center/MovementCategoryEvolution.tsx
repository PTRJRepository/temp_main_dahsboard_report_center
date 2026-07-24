'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type CategoryEvolutionPoint = {
  period: string
  categories: Record<string, { count: number; qty: number; amount: number }>
}

export type MovementMover = {
  code: string
  name: string
  fromCategory: string
  toCategory: string
  firstPeriod: string
  lastPeriod: string
  totalQty: number
  totalAmount: number
}

type MovementCategoryEvolutionProps = {
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  metric?: 'count' | 'qty' | 'amount'
  onMetricChange?: (metric: 'count' | 'qty' | 'amount') => void
  loading?: boolean
  onDrilldown?: (item: { code: string; name: string }) => void
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const CATEGORY_ORDER = ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock']
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

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTH_ID[(Number(m) - 1) % 12] ?? m} ${String(y).slice(2)}`
}

export default function MovementCategoryEvolution({
  periods,
  byPeriod,
  movers,
  totals,
  metric = 'count',
  onMetricChange,
  loading,
  onDrilldown,
}: MovementCategoryEvolutionProps) {
  const [sortKey, setSortKey] = useState<'amount' | 'qty'>('amount')

  const points = useMemo(() => {
    return byPeriod.map((p) => {
      const row: Record<string, number | string> = { period: p.period, label: periodLabel(p.period) }
      for (const category of CATEGORY_ORDER) {
        row[category] = p.categories[category]?.[metric] ?? 0
      }
      return row
    })
  }, [byPeriod, metric])

  const sortedMovers = useMemo(() => {
    const key = sortKey === 'qty' ? 'totalQty' : 'totalAmount'
    return [...movers].sort((a, b) => b[key] - a[key]).slice(0, 12)
  }, [movers, sortKey])

  if (loading && periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat evolusi kategori…</p>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03] p-4 text-center">
        <p className="text-sm font-bold text-[var(--rc-text-muted)]">Belum ada data evolusi kategori untuk filter ini.</p>
        <p className="rc-data mt-1 text-[11px] text-[var(--rc-text-faint)]">Ubah periode, lokasi, atau tipe barang.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--rc-text)]">Evolusi kategori movement</p>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            {metric === 'count' && `Total ${totals.itemCount} barang · ${movers.length} berpindah kategori`}
            {metric === 'qty' && `Total qty ${formatCompact(totals.qty)}`}
            {metric === 'amount' && `Total issue amount Rp ${formatCompact(totals.amount)}`}
          </p>
        </div>
        {onMetricChange ? (
          <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist">
            {(['count', 'qty', 'amount'] as const).map((m) => (
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
                {m === 'count' ? 'Jumlah' : m === 'qty' ? 'Qty' : 'Amount'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} stackOffset="expand" margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={18} />
            <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              contentStyle={{ background: '#0a1510', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, fontSize: 11 }}
              labelStyle={{ color: '#a7f3d0', fontWeight: 700 }}
              formatter={(value, name) => [metric === 'amount' ? `Rp ${formatCompact(Number(value))}` : formatCompact(Number(value)), name]}
            />
            {CATEGORY_ORDER.map((category) => (
              <Bar key={category} dataKey={category} stackId="a" fill={TONE_FILL[category]} radius={[2, 2, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {movers.length > 0 && (
        <div className="mt-3 min-h-0 flex-1 overflow-auto border-t border-white/[0.06] pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--rc-text)]">Barang berpindah kategori</p>
            <div className="flex gap-1">
              {(['amount', 'qty'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={`text-[10px] font-semibold ${sortKey === k ? 'text-emerald-200' : 'text-[var(--rc-text-faint)]'}`}
                >
                  {k === 'amount' ? 'Amount' : 'Qty'}
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-1">
            {sortedMovers.map((mover) => (
              <li key={mover.code}>
                <button
                  type="button"
                  onClick={() => onDrilldown?.({ code: mover.code, name: mover.name })}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.05]"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--rc-text)]">
                    {mover.name}
                  </span>
                  <span className="rc-data text-[10px] text-[var(--rc-text-muted)]">
                    {mover.fromCategory} → {mover.toCategory}
                  </span>
                  <span className="rc-data shrink-0 text-[10px] text-[var(--rc-text-muted)]">
                    Rp {formatCompact(mover.totalAmount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
