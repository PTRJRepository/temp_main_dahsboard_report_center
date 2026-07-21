'use client'

import { AlertTriangle, ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react'

export type InventoryExceptionItem = {
  id: string
  title: string
  description: string
  valueLabel: string
  severity: 'critical' | 'warning' | 'watch'
  scope: string
  onOpen: () => void
}

type ExceptionQueueProps = {
  items: InventoryExceptionItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

const severityClass: Record<InventoryExceptionItem['severity'], string> = {
  critical: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
  warning: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  watch: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
}

export function ExceptionQueue({ items, loading, error, onRetry }: ExceptionQueueProps) {
  const topItem = items[0]

  return (
    <section className="rounded-[26px] border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Exception queue</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--rc-text)]">Prioritas tindakan</h3>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
          <ShieldAlert size={18} />
        </span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-200" />
            <div>
              <p className="text-sm font-black text-rose-100">Overview gagal dimuat</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-rose-100/80">{error}</p>
            </div>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rc-forest-focus mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300/25 bg-white/10 px-3 py-2 text-xs font-black text-rose-50 hover:bg-white/15"
            >
              <RefreshCw size={13} />
              Retry scope ini
            </button>
          ) : null}
        </div>
      ) : topItem ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={topItem.onOpen}
            className={`rc-forest-focus group w-full rounded-2xl border p-4 text-left transition hover:bg-white/[0.08] ${severityClass[topItem.severity]}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="text-[11px] font-black uppercase tracking-[0.16em] opacity-80">Highest priority</span>
                <strong className="mt-2 block text-xl tracking-[-0.04em]">{topItem.title}</strong>
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black">{topItem.valueLabel}</span>
            </span>
            <span className="mt-3 block text-sm font-semibold leading-6 opacity-85">{topItem.description}</span>
            <span className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              Buka filtered report
              <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
            </span>
          </button>

          {items.slice(1, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onOpen}
              className="rc-forest-focus grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[var(--rc-text)]">{item.title}</span>
                <span className="mt-1 block truncate text-xs font-semibold text-[var(--rc-text-faint)]">{item.scope}</span>
              </span>
              <span className="text-sm font-black text-[var(--rc-forest-accent)]">{item.valueLabel}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-[var(--rc-text-faint)]">
          Tidak ada exception prioritas untuk scope ini. Tetap gunakan catalog di bawah untuk drill-down manual.
        </div>
      )}
    </section>
  )
}

export default ExceptionQueue
