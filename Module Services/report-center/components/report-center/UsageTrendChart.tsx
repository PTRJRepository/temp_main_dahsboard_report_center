'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TrendRow = {
  month?: string
  events?: number
  qty?: number
  amount?: number
}

type UsageTrendChartProps = {
  data: TrendRow[]
  loading?: boolean
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function monthLabel(month: string) {
  const [y, m] = month.split('-')
  const idx = Number(m) - 1
  return `${MONTH_ID[idx] ?? m} ${String(y).slice(2)}`
}

export default function UsageTrendChart({ data, loading }: UsageTrendChartProps) {
  const points = useMemo(
    () =>
      (data ?? [])
        .filter((row) => row?.month)
        .map((row) => ({
          month: row.month as string,
          label: monthLabel(row.month as string),
          amount: Number(row.amount ?? 0),
          qty: Number(row.qty ?? 0),
          events: Number(row.events ?? 0),
        })),
    [data],
  )

  if (!points.length) {
    return (
      <div className="grid h-full min-h-[180px] place-items-center rounded-2xl border-[var(--rc-forest-border)] bg-black/20 text-[11px] font-semibold text-[var(--rc-text-faint)]">
        {loading ? 'Memuat trend…' : 'Trend bulanan belum tersedia untuk filter ini.'}
      </div>
    )
  }

  const peak = points.reduce((acc, p) => (p.amount > acc.amount ? p : acc), points[0])

  return (
    <div className="flex h-full min-h-[180px] flex-col">
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <div>
          <p className="rc-eyebrow text-[var(--rc-forest-accent)]">Trend pemakaian</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--rc-text-muted)]">
            {points.length} bulan · puncak {peak.label} — Rp {formatCompact(peak.amount)}
          </p>
        </div>
        <span className="rc-chip">
          <span>Puncak </span>
          <strong>Rp {formatCompact(peak.amount)}</strong>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rcTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9be23d" stopOpacity={0.42} />
                <stop offset="55%" stopColor="#18b96b" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#18b96b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rcTrendStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#18b96b" />
                <stop offset="100%" stopColor="#9be23d" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(172,255,188,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={{ stroke: 'rgba(172,255,188,0.14)' }}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              width={44}
              tick={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(155,226,61,0.35)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#07110d',
                border: '1px solid rgba(172,255,188,0.22)',
                borderRadius: 12,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
              }}
              labelStyle={{ color: '#9be23d', fontWeight: 700 }}
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value ?? 0)
                if (name === 'amount') return [`Rp ${formatCompact(v)}`, 'Nilai']
                if (name === 'qty') return [formatCompact(v), 'Qty']
                return [v, 'Event']
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="url(#rcTrendStroke)"
              strokeWidth={2.2}
              fill="url(#rcTrendFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#9be23d', stroke: '#050b08', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
