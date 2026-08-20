'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, Pin, PinOff } from 'lucide-react'
import { intelligenceModules, type IntelligenceModule } from '@/modules/report-center/lib/reports/intelligence'

export type Module = IntelligenceModule

export const MODULES = intelligenceModules

type ModuleCardProps = {
  module: IntelligenceModule
  active?: boolean
  pinned?: boolean
  onPreview?: (module: IntelligenceModule) => void
  onPin?: (module: IntelligenceModule) => void
  className?: string
}

export default function ModuleCard({
  module,
  active = false,
  pinned = false,
  onPreview,
  onPin,
  className = '',
}: ModuleCardProps) {
  const Icon = module.icon

  return (
    <article
      onMouseEnter={() => onPreview?.(module)}
      className={[
        'group relative flex h-full min-h-[210px] flex-col overflow-hidden rounded-2xl border p-4 transition',
        active
          ? 'rc-panel-active'
          : 'rc-panel hover:-translate-y-0.5 hover:border-[var(--rc-border-strong)]',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[var(--rc-accent)] opacity-60" />

      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onPreview?.(module)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 text-amber-300"
          aria-label={`Lihat monitoring ${module.name}`}
        >
          <Icon size={22} strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-2">
          <span
            className={[
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              module.available
                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300'
                : 'border-slate-400/20 bg-white/5 text-[var(--rc-text-muted)]',
            ].join(' ')}
          >
            {module.available ? 'Live' : 'Katalog'}
          </span>
          <button
            type="button"
            onClick={() => onPin?.(module)}
            className={[
              'grid h-8 w-8 place-items-center rounded-xl border transition',
              pinned
                ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
                : 'border-white/10 bg-white/5 text-[var(--rc-text-faint)] hover:text-amber-300',
            ].join(' ')}
            aria-label={pinned ? 'Unpin module' : 'Pin module'}
          >
            {pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
          </button>
        </div>
      </div>

      <button type="button" onClick={() => onPreview?.(module)} className="mt-4 min-w-0 flex-1 text-left">
        <div className="flex items-end gap-2">
          <h3 className="truncate text-lg font-bold text-[var(--rc-text)]">{module.name}</h3>
          <span className="pb-0.5 text-xs font-semibold text-[var(--rc-text-faint)]">{module.reportCount} laporan</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--rc-text-muted)]">{module.description}</p>
      </button>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
          <BarChart3 size={13} className="text-amber-300" />
          Primary chart
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-[var(--rc-text)]">{module.primaryChart.replace(/_/g, ' ')}</p>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-white/10 pt-3">
        <Link
          href={module.route}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
        >
          Detail Modul
        </Link>
        <Link
          href={module.route}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--rc-accent)] px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          Buka
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}
