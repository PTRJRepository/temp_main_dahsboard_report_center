'use client'

import { ArrowRight, PieChart } from 'lucide-react'

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

const toneClass: Record<MovementCompositionSegment['tone'], string> = {
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

export function MovementComposition({ segments, loading, empty }: MovementCompositionProps) {
  return (
    <section className="rounded-[26px] border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Movement mix</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--rc-text)]">Komposisi movement periodik</h3>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-forest-accent)]">
          <PieChart size={18} />
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[62px] animate-pulse rounded-2xl bg-white/[0.06]" />
        )) : empty ? (
          <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-[var(--rc-text-faint)]">
            Belum ada breakdown movement untuk scope ini.
          </div>
        ) : segments.map((segment) => (
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
                className={`block h-full rounded-full bg-gradient-to-r ${toneClass[segment.tone]}`}
                style={{ width: `${Math.max(4, Math.min(100, segment.share))}%` }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default MovementComposition
