'use client'

import { useState } from 'react'
import {
  ArrowRight,
  BarChart2,
  PieChart as PieChartIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type MovementCompositionSegment = {
  id: string
  label: string
  value: number
  valueLabel: string
  share: number
  scope: string
  tone: 'fast' | 'moving' | 'slow' | 'dead' | 'stale' | 'neutral'
  onSelect: () => void
}

type MovementCompositionProps = {
  segments: MovementCompositionSegment[]
  loading?: boolean
  empty?: boolean
}

type ViewMode = 'list' | 'bar' | 'donut'

const toneClass: Record<MovementCompositionSegment['tone'], string> = {
  fast: 'fill-emerald-400 stroke-emerald-500',
  moving: 'fill-cyan-400 stroke-cyan-500',
  slow: 'fill-amber-400 stroke-amber-500',
  dead: 'fill-rose-400 stroke-rose-500',
  stale: 'fill-slate-400 stroke-slate-500',
  neutral: 'fill-emerald-400 stroke-emerald-500',
}

const toneBarFill: Record<MovementCompositionSegment['tone'], string> = {
  fast: '#34d399',
  moving: '#22d3ee',
  slow: '#fbbf24',
  dead: '#fb7185',
  stale: '#94a3b8',
  neutral: '#34d399',
}

const toneGradientClass: Record<MovementCompositionSegment['tone'], string> = {
  fast: 'from-emerald-300 to-lime-300',
  moving: 'from-cyan-300 to-emerald-300',
  slow: 'from-amber-300 to-orange-300',
  dead: 'from-rose-300 to-red-400',
  stale: 'from-slate-300 to-stone-400',
  neutral: 'from-emerald-300 to-teal-300',
}

export function movementTone(label: string): MovementCompositionSegment['tone'] {
  const text = label.toLowerCase()
  if (text.includes('fast')) return 'fast'
  if (text === 'moving' || text.includes('moving -')) return 'moving'
  if (text.includes('slow')) return 'slow'
  if (text.includes('dead')) return 'dead'
  if (text.includes('stale')) return 'stale'
  return 'neutral'
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: MovementCompositionSegment }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-xl border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.92)] px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-[var(--rc-text)]">{d.payload.label}</p>
      <p className="mt-0.5 font-semibold text-[var(--rc-forest-accent)]">{d.payload.valueLabel}</p>
      <p className="font-semibold text-[var(--rc-text-muted)]">{d.payload.share.toFixed(1)}%</p>
    </div>
  )
}

export function MovementComposition({ segments, loading, empty }: MovementCompositionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  return (
    <section className="rounded-[26px] border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Movement mix</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--rc-text)]">Komposisi movement periodik</h3>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rc-forest-focus grid h-8 w-8 place-items-center rounded-lg transition ${
              viewMode === 'list'
                ? 'bg-white/[0.10] text-[var(--rc-forest-accent)]'
                : 'text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]'
            }`}
            title="List view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`rc-forest-focus grid h-8 w-8 place-items-center rounded-lg transition ${
              viewMode === 'bar'
                ? 'bg-white/[0.10] text-[var(--rc-forest-accent)]'
                : 'text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]'
            }`}
            title="Bar chart"
          >
            <BarChart2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('donut')}
            className={`rc-forest-focus grid h-8 w-8 place-items-center rounded-lg transition ${
              viewMode === 'donut'
                ? 'bg-white/[0.10] text-[var(--rc-forest-accent)]'
                : 'text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]'
            }`}
            title="Donut chart"
          >
            <PieChartIcon size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[62px] animate-pulse rounded-2xl bg-white/[0.06]" />
        )) : empty ? (
          <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-[var(--rc-text-faint)]">
            Belum ada breakdown movement untuk scope ini.
          </div>
        ) : viewMode === 'bar' ? (
          <div className="pt-2 pb-1">
            <ResponsiveContainer width="100%" height={Math.max(200, segments.length * 60 + 20)}>
              <BarChart
                data={segments}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                barCategoryGap="25%"
                barGap={8}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => {
                    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                    return String(v)
                  }}
                  tick={{ fill: 'rgba(167,139,100,0.65)', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: 'rgba(167,139,100,0.20)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tick={{ fill: 'rgba(167,139,100,0.80)', fontSize: 11, fontWeight: 800 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar
                  dataKey="value"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(bar) => bar?.payload?.onSelect?.()}
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {segments.map((seg) => (
                    <Cell key={seg.id} fill={toneBarFill[seg.tone]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-[10px] font-semibold text-[var(--rc-text-muted)]">
              Klik bar untuk filter item di category tersebut
            </p>
          </div>
        ) : viewMode === 'donut' ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={3}
                  cursor="pointer"
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                  startAngle={90}
                  endAngle={-270}
                >
                  {segments.map((seg) => (
                    <Cell
                      key={seg.id}
                      fill={toneBarFill[seg.tone]}
                      stroke="rgba(5,17,10,0.6)"
                      strokeWidth={2}
                      onClick={() => seg.onSelect()}
                      cursor="pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={seg.onSelect}
                  className="rc-forest-focus flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.05] transition"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                    style={{ backgroundColor: toneBarFill[seg.tone] }}
                  />
                  <span className="min-w-0 truncate text-xs font-semibold text-[var(--rc-text)]">{seg.label}</span>
                  <span className="ml-auto flex-none text-[10px] font-black text-[var(--rc-forest-accent)]">{seg.share.toFixed(0)}%</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] font-semibold text-[var(--rc-text-muted)]">
              Klik irisan untuk filter item
            </p>
          </div>
        ) : (
          segments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              onClick={segment.onSelect}
              className="rc-forest-focus group w-full rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3 text-left transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.07]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[var(--rc-text)]">{segment.label}</span>
                  <span className="mt-1 block text-xs font-semibold text-[var(--rc-text-faint)]">{segment.scope} · {segment.share.toFixed(1)}%</span>
                </span>
                <span className="flex items-center gap-2 text-sm font-black text-[var(--rc-forest-accent)]">
                  {segment.valueLabel}
                  <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </span>
              <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full bg-gradient-to-r ${toneGradientClass[segment.tone]}`}
                  style={{ width: `${Math.max(4, Math.min(100, segment.share))}%` }}
                />
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

export default MovementComposition
