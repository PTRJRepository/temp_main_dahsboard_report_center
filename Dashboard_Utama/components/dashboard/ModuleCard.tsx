'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, Pin, PinOff } from 'lucide-react'
import { intelligenceModules, type IntelligenceModule } from '@/lib/reports/intelligence'

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
        'group relative flex h-full min-h-[274px] flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition',
        active
          ? 'border-emerald-300 ring-4 ring-emerald-500/10'
          : 'border-slate-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_55px_rgba(15,23,42,0.12)]',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: module.accent }} />

      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onPreview?.(module)}
          className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg"
          style={{ backgroundColor: module.accent }}
          aria-label={`Lihat monitoring ${module.name}`}
        >
          <Icon size={27} strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-2">
          <span
            className={[
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              module.available
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500',
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
                ? 'border-amber-200 bg-amber-50 text-amber-600'
                : 'border-slate-200 bg-white text-slate-400 hover:text-amber-600',
            ].join(' ')}
            aria-label={pinned ? 'Unpin module' : 'Pin module'}
          >
            {pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
          </button>
        </div>
      </div>

      <button type="button" onClick={() => onPreview?.(module)} className="mt-5 min-w-0 flex-1 text-left">
        <div className="flex items-end gap-2">
          <h3 className="truncate text-xl font-semibold text-slate-950">{module.name}</h3>
          <span className="pb-0.5 text-sm font-semibold text-slate-400">{module.reportCount} laporan</span>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{module.description}</p>
      </button>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 opacity-100 transition group-hover:border-emerald-100 group-hover:bg-emerald-50/60">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <BarChart3 size={14} style={{ color: module.accent }} />
          Primary chart
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">{module.primaryChart.replace(/_/g, ' ')}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Hover summary: {module.insight.summary}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => onPreview?.(module)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Monitoring
        </button>
        <Link
          href={module.route}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#167A3A] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#0f6a30]"
        >
          Buka Modul
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}
