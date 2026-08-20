'use client'

import { useEffect, useMemo, useState } from 'react'

type AggregationStatus = {
  success: boolean
  currentPeriod: string
  closedPeriods: string[]
}

type PeriodScrubberProps = {
  /** Periode aktif saat ini (YYYY-MM). */
  value: string
  onSelect: (period: string) => void
  /** Jumlah titik bulan ke belakang (default 18). */
  months?: number
  /**
   * True = selected period is the real current calendar period (live balance).
   * False/undefined = past/closed period (monthend snapshot).
   */
  isCurrentPeriod?: boolean
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function addMonths(period: string, delta: number) {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthName(period: string) {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return MONTH_ID[m - 1]
}

function yearShort(period: string) {
  const y = period.split('-')[0]
  return y ? String(Number(y)).slice(2) : ''
}

function yearFull(period: string) {
  return period.split('-')[0] ?? ''
}

export default function PeriodScrubber({
  value,
  onSelect,
  months = 18,
  isCurrentPeriod,
}: PeriodScrubberProps) {
  const [status, setStatus] = useState<AggregationStatus | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/reports/inventory/aggregation?months=' + months, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive && json && json.success) setStatus(json as AggregationStatus)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [months])

  const current = status?.currentPeriod ?? value
  const closed = useMemo(() => new Set(status?.closedPeriods ?? []), [status])

  const ticks = useMemo(() => {
    const list: string[] = []
    for (let i = months - 1; i >= 0; i -= 1) list.push(addMonths(current, -i))
    return list
  }, [current, months])

  const activeInClosed = closed.has(value)
  // Prefer explicit prop from parent; fallback: selected tick equals aggregation current period.
  const selectedIsCurrent = typeof isCurrentPeriod === 'boolean'
    ? isCurrentPeriod
    : value === current

  return (
    <div
      className={`w-full min-w-0 rounded-2xl border px-3 pb-3 pt-3 sm:px-4 ${
        selectedIsCurrent
          ? 'border-sky-300/35 bg-[linear-gradient(180deg,rgba(14,40,55,.78),rgba(3,12,8,.55))] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]'
          : 'border-amber-300/30 bg-[linear-gradient(180deg,rgba(40,28,8,.78),rgba(3,12,8,.55))] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.10)]'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="rc-data text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
            Jelajah periode
          </span>
          <span className="text-[17px] font-black leading-none tracking-[-0.02em] text-[var(--rc-text)] sm:text-[19px]">
            {monthName(value)}
            <span className="ml-1 text-[13px] font-bold text-[var(--rc-forest-accent)] sm:text-[14px]">20{yearShort(value)}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
              selectedIsCurrent
                ? 'border-sky-300/40 bg-sky-400/20 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.22)]'
                : 'border-amber-300/40 bg-amber-400/20 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
            }`}
            title={selectedIsCurrent
              ? 'Periode CURRENT aktif: data live balance (monthend belum closing).'
              : 'Periode PAST aktif: data snapshot monthend / closed period.'}
          >
            <span className={`h-2 w-2 rounded-full ${selectedIsCurrent ? 'bg-sky-300 animate-pulse' : 'bg-amber-300'}`} />
            {selectedIsCurrent ? 'CURRENT · live' : 'PAST · monthend'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
              activeInClosed
                ? 'bg-emerald-400/15 text-emerald-200'
                : 'bg-white/5 text-[var(--rc-text-muted)]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${activeInClosed ? 'bg-emerald-300' : 'bg-white/40'}`} />
            {activeInClosed ? 'Instan cache' : 'Query live'}
          </span>
        </div>
        <span className="rc-data text-[10px] text-[var(--rc-text-faint)] sm:text-[11px]">
          aktif = {selectedIsCurrent ? 'CURRENT' : 'PAST'} · titik penuh = instan · berongga = live
        </span>
      </div>

      <div className="relative w-full min-w-0">
        <div
          className="rc-period-track relative flex w-full min-w-0 items-end justify-between gap-0 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Pilih periode"
        >
          <span className="pointer-events-none absolute bottom-[22px] left-1 right-1 h-px bg-white/[0.08]" aria-hidden />

          {ticks.map((period, idx) => {
            const active = period === value
            const isClosed = closed.has(period)
            const isYearStart = period.endsWith('-01')
            const prev = idx > 0 ? ticks[idx - 1] : null
            const showYear = isYearStart || (prev != null && yearFull(prev) !== yearFull(period))
            const tickIsCurrent = period === current
            return (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(period)}
                title={`${monthName(period)} ${yearFull(period)} · ${tickIsCurrent ? 'CURRENT (live)' : 'PAST'}${isClosed ? ' · instan' : ' · live query'}`}
                className={`group relative flex min-w-[2.35rem] flex-1 flex-col items-center gap-1.5 px-0.5 pb-0 pt-4 sm:min-w-[2.75rem] sm:px-1 ${
                  active
                    ? selectedIsCurrent
                      ? 'rounded-xl bg-sky-400/10 ring-1 ring-sky-300/35'
                      : 'rounded-xl bg-amber-400/10 ring-1 ring-amber-300/35'
                    : ''
                }`}
              >
                {showYear ? (
                  <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 flex-col items-center" aria-hidden>
                    <span className="mx-auto block h-2.5 w-px bg-white/25" />
                    <span className="rc-data mt-0.5 block text-center text-[8px] font-black uppercase tracking-wider text-white/40 sm:text-[9px]">
                      {yearFull(period)}
                    </span>
                  </span>
                ) : null}

                <span
                  className={`relative z-[1] block rounded-full border transition-all duration-200 ${
                    active
                      ? selectedIsCurrent
                        ? 'h-3.5 w-3.5 border-sky-300 bg-sky-300 shadow-[0_0_0_4px_rgba(56,189,248,.20),0_0_14px_rgba(56,189,248,.45)] sm:h-4 sm:w-4'
                        : 'h-3.5 w-3.5 border-amber-300 bg-amber-300 shadow-[0_0_0_4px_rgba(245,158,11,.20),0_0_14px_rgba(245,158,11,.45)] sm:h-4 sm:w-4'
                      : isClosed
                        ? 'h-2.5 w-2.5 border-[var(--rc-forest-accent)]/55 bg-[var(--rc-forest-accent)]/45 group-hover:scale-125 group-hover:border-[var(--rc-forest-accent)] group-hover:bg-[var(--rc-forest-accent)] sm:h-3 sm:w-3'
                        : 'h-2.5 w-2.5 border-[var(--rc-text-faint)]/55 bg-transparent group-hover:scale-125 group-hover:border-sky-300/70 group-hover:bg-sky-300/20 sm:h-3 sm:w-3'
                  }`}
                />
                <span
                  className={`rc-data text-[10px] uppercase leading-none tracking-wide transition-colors sm:text-[11px] ${
                    active
                      ? selectedIsCurrent
                        ? 'font-black text-sky-200'
                        : 'font-black text-amber-200'
                      : 'text-[var(--rc-text-faint)] group-hover:text-[var(--rc-text)]'
                  }`}
                >
                  {monthName(period)}
                </span>
                {active ? (
                  <span className={`rc-data text-[8px] font-black uppercase tracking-[0.12em] ${
                    selectedIsCurrent ? 'text-sky-200/90' : 'text-amber-200/90'
                  }`}>
                    {selectedIsCurrent ? 'NOW' : 'PAST'}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
