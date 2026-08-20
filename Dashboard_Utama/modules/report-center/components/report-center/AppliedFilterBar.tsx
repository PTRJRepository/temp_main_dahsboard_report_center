'use client'

import { SlidersHorizontal, X, XCircle } from 'lucide-react'

export type AppliedFilterChip = {
  key: string
  label: string
  columnFilterIndex?: number
  locked?: boolean
}

export type AppliedFilterBarProps = {
  chips: AppliedFilterChip[]
  onRemove: (chip: AppliedFilterChip) => void
  onClearAll: () => void
  /** sticky = lime executive strip; inline = quieter secondary surface */
  variant?: 'sticky' | 'inline'
  emptyLabel?: string
  className?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function AppliedFilterBar({
  chips,
  onRemove,
  onClearAll,
  variant = 'sticky',
  emptyLabel = 'No active filters',
  className,
}: AppliedFilterBarProps) {
  const removable = chips.filter((chip) => !chip.locked)

  if (variant === 'inline' && removable.length === 0) {
    return (
      <div className={cx('flex flex-wrap items-center gap-1.5 text-xs font-semibold', className)}>
        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/40">{emptyLabel}</span>
      </div>
    )
  }

  if (removable.length === 0) return null

  if (variant === 'inline') {
    return (
      <div className={cx('flex flex-wrap items-center gap-1.5 text-xs font-semibold', className)} role="region" aria-label="Active filters">
        {removable.map((chip) => (
          <button
            key={`inline-${chip.key}-${chip.columnFilterIndex ?? chip.label}`}
            type="button"
            onClick={() => onRemove(chip)}
            title={`Hapus filter: ${chip.label}`}
            aria-label={`Hapus filter ${chip.label}`}
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-left text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <span className="truncate">{chip.label}</span>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/60 group-hover:border-red-300/40 group-hover:bg-red-500/25 group-hover:text-red-50">
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-500/20"
          aria-label="Clear all active filters"
        >
          <XCircle size={12} aria-hidden="true" />
          Clear all
        </button>
      </div>
    )
  }

  return (
    <div
      className={cx(
        'mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/10 px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]',
        className,
      )}
      role="region"
      aria-label="Active filters"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lime-200/90">
        <SlidersHorizontal size={12} aria-hidden="true" />
        Active filters
        <span className="rounded-md border border-lime-300/30 bg-lime-300/15 px-1.5 py-0.5 text-[10px] font-black text-lime-100">
          {removable.length}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {removable.map((chip) => (
          <button
            key={`sticky-${chip.key}-${chip.columnFilterIndex ?? chip.label}`}
            type="button"
            onClick={() => onRemove(chip)}
            title={`Hapus filter: ${chip.label}`}
            aria-label={`Hapus filter ${chip.label}`}
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-lime-300/35 bg-[#071426]/80 px-2.5 py-1 text-left text-xs font-bold text-lime-50 transition hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
          >
            <span className="truncate">{chip.label}</span>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 group-hover:border-red-300/40 group-hover:bg-red-500/30 group-hover:text-red-50">
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-red-200 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
        aria-label="Clear all active filters"
      >
        <XCircle size={13} aria-hidden="true" />
        Clear all
      </button>
    </div>
  )
}

export default AppliedFilterBar
