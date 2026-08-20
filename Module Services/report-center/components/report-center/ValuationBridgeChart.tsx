'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * ValuationBridgeChart — Opening → Current bridge for Master KPI.
 * Bars: Opening, Current, Delta; side split Gudang/Workshop for both periods.
 */

type ValuationBridgeChartProps = {
  opening: number
  current: number
  openingGudang?: number
  openingWorkshop?: number
  currentGudang?: number
  currentWorkshop?: number
  openingLabel?: string
  currentLabel?: string
  loading?: boolean
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${(value / 1e12).toFixed(2)} T`
  if (abs >= 1e9) return `${sign}${(value / 1e9).toFixed(2)} M`
  if (abs >= 1e6) return `${sign}${(value / 1e6).toFixed(1)} jt`
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

function formatFull(value: number) {
  if (!Number.isFinite(value)) return 'Rp0,0000'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

const BAR_COLORS: Record<string, string> = {
  Opening: '#f59e0b',
  Current: '#34d399',
  Delta: '#60a5fa',
  'Gudang Open': '#d97706',
  'Gudang Now': '#10b981',
  'WS Open': '#fbbf24',
  'WS Now': '#6ee7b7',
}

export default function ValuationBridgeChart({
  opening,
  current,
  openingGudang = 0,
  openingWorkshop = 0,
  currentGudang = 0,
  currentWorkshop = 0,
  openingLabel = 'Opening',
  currentLabel = 'Current',
  loading,
}: ValuationBridgeChartProps) {
  const delta = current - opening
  const deltaPct = opening !== 0 ? (delta / opening) * 100 : null

  const bridge = useMemo(() => ([
    { name: 'Opening', value: opening, kind: 'Opening' },
    { name: 'Current', value: current, kind: 'Current' },
    { name: 'Delta', value: delta, kind: 'Delta' },
  ]), [opening, current, delta])

  const split = useMemo(() => ([
    { name: 'Gudang Open', value: openingGudang, kind: 'Gudang Open' },
    { name: 'Gudang Now', value: currentGudang, kind: 'Gudang Now' },
    { name: 'WS Open', value: openingWorkshop, kind: 'WS Open' },
    { name: 'WS Now', value: currentWorkshop, kind: 'WS Now' },
  ]), [openingGudang, currentGudang, openingWorkshop, currentWorkshop])

  if (loading) {
    return (
      <div className="grid h-[320px] place-items-center rounded-2xl border border-white/10 bg-black/20 text-sm font-semibold text-[var(--rc-text-faint)]">
        Memuat bridge valuasi…
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-[22px] border border-emerald-300/20 bg-black/25 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200/85">
            Opening → Current bridge
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--rc-text-muted)]">
            {openingLabel} → {currentLabel}
            {deltaPct === null ? '' : ` · Δ ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`}
          </p>
        </div>
        <span className={`max-w-full break-all rounded-full border px-3 py-1 text-xs font-black ${
          delta > 0
            ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
            : delta < 0
              ? 'border-rose-300/30 bg-rose-400/15 text-rose-100'
              : 'border-white/10 bg-white/5 text-[var(--rc-text-muted)]'
        }`}>
          {formatFull(delta)}
        </span>
      </div>

      <div className="h-[220px] min-w-0 sm:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bridge} margin={{ top: 28, right: 10, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ecdb0', fontSize: 12, fontFamily: 'var(--font-data)', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={54}
              tick={{ fill: '#8fbfa1', fontSize: 11, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#07110d',
                border: '1px solid rgba(172,255,188,0.22)',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value) => [formatFull(typeof value === 'number' ? value : Number(value ?? 0)), 'Nilai']}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={64}>
              {bridge.map((row) => (
                <Cell
                  key={row.name}
                  fill={row.kind === 'Delta'
                    ? (delta >= 0 ? '#34d399' : '#fb7185')
                    : BAR_COLORS[row.kind]}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => formatCompact(typeof v === 'number' ? v : Number(v ?? 0))}
                style={{ fill: '#d8f5df', fontSize: 12, fontWeight: 800 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[170px] min-w-0 sm:h-[190px]">
        <p className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
          Split Gudang / Workshop
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={split} margin={{ top: 16, right: 10, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#8fbfa1', fontSize: 11, fontFamily: 'var(--font-data)', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              width={50}
              tick={{ fill: '#8fbfa1', fontSize: 11, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#07110d',
                border: '1px solid rgba(172,255,188,0.22)',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value) => [formatFull(typeof value === 'number' ? value : Number(value ?? 0)), 'Nilai']}
            />
            <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={42}>
              {split.map((row) => (
                <Cell key={row.name} fill={BAR_COLORS[row.kind] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/85">Opening</p>
          <p className="mt-1 break-all text-sm font-black leading-snug text-amber-50 sm:text-[15px]" title={formatFull(opening)}>{formatCompact(opening)}</p>
          <p className="mt-0.5 break-all text-[11px] font-semibold text-amber-100/70" title={formatFull(opening)}>{formatFull(opening)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/85">Current</p>
          <p className="mt-1 break-all text-sm font-black leading-snug text-emerald-50 sm:text-[15px]" title={formatFull(current)}>{formatCompact(current)}</p>
          <p className="mt-0.5 break-all text-[11px] font-semibold text-emerald-100/70" title={formatFull(current)}>{formatFull(current)}</p>
        </div>
        <div className={`rounded-2xl border px-3 py-2.5 ${
          delta >= 0
            ? 'border-sky-300/25 bg-sky-400/10'
            : 'border-rose-300/25 bg-rose-400/10'
        }`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Delta</p>
          <p className="mt-1 break-all text-sm font-black leading-snug text-[var(--rc-text)] sm:text-[15px]" title={formatFull(delta)}>{formatCompact(delta)}</p>
          <p className="mt-0.5 break-all text-[11px] font-semibold text-[var(--rc-text-muted)]" title={formatFull(delta)}>{formatFull(delta)}</p>
        </div>
      </div>
    </div>
  )
}
